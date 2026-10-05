// =============================================================================
// AEMS v2 — Query builder over MySQL with a Supabase/PostgREST-compatible API.
// `await db.from(table)...` never throws; it resolves to { data, error, count }.
// Supported: select (with embeds alias:table!fk(...)), insert, update, delete,
// upsert, eq/neq/gt/gte/lt/lte/like/ilike/in/is/not/or, order, limit,
// single, maybeSingle and exact counts.
// =============================================================================

import crypto from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool, getSchema, type ColumnMeta, type SchemaMeta } from './mysql';

export interface DbError {
  message: string;
  code: string;
  details: string | null;
  hint: string | null;
}

 
export interface DbResult<T = any> {
  data: T;
  error: DbError | null;
  count: number | null;
  status: number;
}

type Row = Record<string, unknown>;
type TableMeta = Map<string, ColumnMeta>;

type CmpOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'notis' | 'noteq';
type Cond =
  | { kind: 'cmp'; column: string; op: CmpOp; value: unknown }
  | { kind: 'or'; conds: Cond[] };

interface SelectColumn {
  name: string;
  alias: string | null;
}
interface EmbedNode {
  key: string;
  table: string;
  hint: string | null;
  inner: string;
}
interface SelectNode {
  star: boolean;
  columns: SelectColumn[];
  embeds: EmbedNode[];
}

class DbQueryError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NUMERIC_TYPES = new Set(['int', 'tinyint', 'smallint', 'mediumint', 'bigint', 'decimal', 'float', 'double']);
const IN_CHUNK = 5000;

const MYSQL_TO_PG_CODES: Record<number, string> = {
  1062: '23505',
  1451: '23503',
  1452: '23503',
  1048: '23502',
  1146: '42P01',
  1054: '42703',
  1406: '22001',
  1265: '22P02',
  1366: '22P02',
};

function q(identifier: string): string {
  if (!IDENT.test(identifier)) throw new DbQueryError(`Invalid identifier "${identifier}"`, 'PGRST100');
  return `\`${identifier}\``;
}

function toDbError(err: unknown): DbError {
  if (err instanceof DbQueryError) {
    return { message: err.message, code: err.code, details: null, hint: null };
  }
  const e = err as { errno?: number; code?: string; sqlMessage?: string; message?: string };
  const code = (e.errno && MYSQL_TO_PG_CODES[e.errno]) || e.code || 'UNKNOWN';
  let message = e.sqlMessage || e.message || 'Database error';
  if (code === '23505') message = `duplicate key value violates unique constraint: ${message}`;
  if (code === '23503') message = `violates foreign key constraint: ${message}`;
  return { message, code, details: e.code || null, hint: null };
}

function failure(error: DbError): DbResult {
  return { data: null, error, count: null, status: 400 };
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of input) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseSelect(input: string): SelectNode {
  const node: SelectNode = { star: false, columns: [], embeds: [] };
  for (const part of splitTopLevel(input || '*')) {
    const embed = part.match(/^(?:([A-Za-z_]\w*)\s*:\s*)?([A-Za-z_]\w*)(?:!([A-Za-z_]\w*))?\s*\(([\s\S]*)\)$/);
    if (embed) {
      node.embeds.push({ key: embed[1] || embed[2], table: embed[2], hint: embed[3] || null, inner: embed[4].trim() || '*' });
    } else if (part === '*') {
      node.star = true;
    } else {
      const [first, second] = part.split(':').map((s) => s.trim());
      node.columns.push(second ? { name: second, alias: first } : { name: first, alias: null });
    }
  }
  if (!node.star && node.columns.length === 0 && node.embeds.length === 0) node.star = true;
  return node;
}

function toMysqlDateTime(value: unknown): unknown {
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return value;
  return d.toISOString().replace('T', ' ').replace('Z', '');
}

function convertValue(meta: ColumnMeta | undefined, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  const type = meta?.dataType;
  if (type === 'json') return JSON.stringify(value);
  if (type === 'datetime' || type === 'timestamp') return value === '' ? null : toMysqlDateTime(value);
  if (type === 'date') {
    if (value === '') return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const s = String(value);
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  }
  if (type && NUMERIC_TYPES.has(type) && value === '') return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) return JSON.stringify(value);
  return value;
}

function parseOrValue(raw: string): unknown {
  let v = raw;
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

function parseOrString(input: string): Cond[] {
  return splitTopLevel(input).map((part) => {
    const firstDot = part.indexOf('.');
    const secondDot = part.indexOf('.', firstDot + 1);
    if (firstDot < 0 || secondDot < 0) throw new DbQueryError(`Invalid or() filter "${part}"`, 'PGRST100');
    const column = part.slice(0, firstDot);
    let op = part.slice(firstDot + 1, secondDot);
    let rest = part.slice(secondDot + 1);
    let negate = false;
    if (op === 'not') {
      negate = true;
      const nextDot = rest.indexOf('.');
      op = rest.slice(0, nextDot);
      rest = rest.slice(nextDot + 1);
    }
    if (op === 'in') {
      const list = rest.replace(/^\(|\)$/g, '');
      return { kind: 'cmp', column, op: 'in', value: splitTopLevel(list).map(parseOrValue) } as Cond;
    }
    const value = parseOrValue(rest);
    if (negate && op === 'is') return { kind: 'cmp', column, op: 'notis', value } as Cond;
    if (negate && op === 'eq') return { kind: 'cmp', column, op: 'noteq', value } as Cond;
    if (!['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is'].includes(op)) {
      throw new DbQueryError(`Unsupported or() operator "${op}"`, 'PGRST100');
    }
    return { kind: 'cmp', column, op: op as CmpOp, value } as Cond;
  });
}

function compileCond(cond: Cond, meta: TableMeta): { sql: string; params: unknown[] } {
  if (cond.kind === 'or') {
    const compiled = cond.conds.map((c) => compileCond(c, meta));
    if (compiled.length === 0) return { sql: '1 = 1', params: [] };
    return { sql: `(${compiled.map((c) => c.sql).join(' OR ')})`, params: compiled.flatMap((c) => c.params) };
  }
  const col = q(cond.column);
  const colMeta = meta.get(cond.column);
  const v = cond.value;
  switch (cond.op) {
    case 'eq':
      return v === null ? { sql: `${col} IS NULL`, params: [] } : { sql: `${col} = ?`, params: [convertValue(colMeta, v)] };
    case 'neq':
    case 'noteq':
      return v === null ? { sql: `${col} IS NOT NULL`, params: [] } : { sql: `${col} <> ?`, params: [convertValue(colMeta, v)] };
    case 'gt':
      return { sql: `${col} > ?`, params: [convertValue(colMeta, v)] };
    case 'gte':
      return { sql: `${col} >= ?`, params: [convertValue(colMeta, v)] };
    case 'lt':
      return { sql: `${col} < ?`, params: [convertValue(colMeta, v)] };
    case 'lte':
      return { sql: `${col} <= ?`, params: [convertValue(colMeta, v)] };
    case 'like':
      return { sql: `${col} LIKE ?`, params: [String(v)] };
    case 'ilike':
      return { sql: `LOWER(${col}) LIKE LOWER(?)`, params: [String(v)] };
    case 'in': {
      const list = Array.isArray(v) ? v : [];
      if (list.length === 0) return { sql: '1 = 0', params: [] };
      return { sql: `${col} IN (${list.map(() => '?').join(', ')})`, params: list.map((item) => convertValue(colMeta, item)) };
    }
    case 'is':
      if (v === null) return { sql: `${col} IS NULL`, params: [] };
      return { sql: `${col} = ?`, params: [v ? 1 : 0] };
    case 'notis':
      if (v === null) return { sql: `${col} IS NOT NULL`, params: [] };
      return { sql: `${col} <> ?`, params: [v ? 1 : 0] };
  }
}

function resolveRelation(schema: SchemaMeta, table: string, embed: EmbedNode) {
  const manyToOne = schema.foreignKeys.find(
    (fk) => fk.table === table && fk.refTable === embed.table && (!embed.hint || fk.column === embed.hint)
  );
  if (manyToOne) {
    return { kind: 'many-to-one' as const, localColumn: manyToOne.column, remoteColumn: manyToOne.refColumn, unique: true };
  }
  const oneToMany = schema.foreignKeys.find(
    (fk) => fk.table === embed.table && fk.refTable === table && (!embed.hint || fk.column === embed.hint)
  );
  if (oneToMany) {
    return {
      kind: 'one-to-many' as const,
      localColumn: oneToMany.refColumn,
      remoteColumn: oneToMany.column,
      unique: schema.uniqueColumns.has(`${embed.table}.${oneToMany.column}`),
    };
  }
  throw new DbQueryError(`Could not find a relationship between '${table}' and '${embed.table}'`, 'PGRST200');
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

 
export class QueryBuilder<TData = any[]> implements PromiseLike<DbResult<TData>> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private selectStr = '*';
  private returning = false;
  private countExact = false;
  private headOnly = false;
  private conds: Cond[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private limitCount: number | null = null;
  private singleMode: 'single' | 'maybe' | null = null;
   
  private payload: any = null;
  private onConflict: string | null = null;
  private ignoreDuplicates = false;
  private requiredColumns: string[] = [];
  private buildError: DbQueryError | null = null;
  private affectedRows: number | null = null;

  constructor(private readonly table: string) {}

  select(columns = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): this {
    this.selectStr = columns;
    if (this.op === 'select') {
      this.countExact = !!options?.count;
      this.headOnly = !!options?.head;
    } else {
      this.returning = true;
    }
    return this;
  }

  insert(values: object | object[]): this {
    this.op = 'insert';
    this.payload = values;
    return this;
  }

  upsert(values: object | object[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): this {
    this.op = 'upsert';
    this.payload = values;
    this.onConflict = options?.onConflict || null;
    this.ignoreDuplicates = !!options?.ignoreDuplicates;
    return this;
  }

  update(values: object): this {
    this.op = 'update';
    this.payload = values;
    return this;
  }

  delete(): this {
    this.op = 'delete';
    return this;
  }

  private cmp(column: string, op: CmpOp, value: unknown): this {
    this.conds.push({ kind: 'cmp', column, op, value });
    return this;
  }

  eq(column: string, value: unknown): this { return this.cmp(column, 'eq', value); }
  neq(column: string, value: unknown): this { return this.cmp(column, 'neq', value); }
  gt(column: string, value: unknown): this { return this.cmp(column, 'gt', value); }
  gte(column: string, value: unknown): this { return this.cmp(column, 'gte', value); }
  lt(column: string, value: unknown): this { return this.cmp(column, 'lt', value); }
  lte(column: string, value: unknown): this { return this.cmp(column, 'lte', value); }
  like(column: string, pattern: string): this { return this.cmp(column, 'like', pattern); }
  ilike(column: string, pattern: string): this { return this.cmp(column, 'ilike', pattern); }
  in(column: string, values: readonly unknown[]): this { return this.cmp(column, 'in', [...values]); }
  is(column: string, value: null | boolean): this { return this.cmp(column, 'is', value); }

  not(column: string, operator: string, value: unknown): this {
    if (operator === 'is') return this.cmp(column, 'notis', value);
    if (operator === 'eq') return this.cmp(column, 'noteq', value);
    this.buildError = new DbQueryError(`Unsupported not() operator "${operator}"`, 'PGRST100');
    return this;
  }

  or(filters: string): this {
    try {
      this.conds.push({ kind: 'or', conds: parseOrString(filters) });
    } catch (err) {
      this.buildError = err as DbQueryError;
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

   
  single(): QueryBuilder<any> {
    this.singleMode = 'single';
    return this;
  }

   
  maybeSingle(): QueryBuilder<any> {
    this.singleMode = 'maybe';
    return this;
  }

  withRequiredColumns(columns: string[]): this {
    this.requiredColumns.push(...columns);
    return this;
  }

  then<TResult1 = DbResult<TData>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<TData>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return (this.execute() as Promise<DbResult<TData>>).then(onfulfilled, onrejected);
  }

  async execute(): Promise<DbResult> {
    try {
      if (this.buildError) throw this.buildError;
      const schema = await getSchema();
      const meta = schema.tables.get(this.table);
      if (!meta) throw new DbQueryError(`relation "${this.table}" does not exist`, '42P01');

      let rows: Row[] | null;
      let count: number | null = null;
      switch (this.op) {
        case 'select': {
          const res = await this.runSelect(schema, meta);
          rows = res.rows;
          count = res.count;
          break;
        }
        case 'insert':
        case 'upsert':
          rows = await this.runInsert(schema, meta);
          break;
        case 'update':
          rows = await this.runUpdate(schema, meta);
          // Without .select(), count is the number of rows the single atomic UPDATE changed.
          if (!this.returning) count = this.affectedRows;
          break;
        case 'delete':
          rows = await this.runDelete(schema, meta);
          break;
      }

      return this.shape(rows, count);
    } catch (err) {
      return failure(toDbError(err));
    }
  }

  private shape(rows: Row[] | null, count: number | null): DbResult {
    if (this.singleMode) {
      const list = rows || [];
      if (list.length === 1) return { data: list[0], error: null, count, status: 200 };
      if (list.length === 0 && this.singleMode === 'maybe') return { data: null, error: null, count, status: 200 };
      return failure({
        message: 'JSON object requested, multiple (or no) rows returned',
        code: 'PGRST116',
        details: `The result contains ${list.length} rows`,
        hint: null,
      });
    }
    return { data: rows, error: null, count, status: 200 };
  }

  private whereClause(meta: TableMeta): { sql: string; params: unknown[] } {
    if (this.conds.length === 0) return { sql: '', params: [] };
    const compiled = this.conds.map((c) => compileCond(c, meta));
    return { sql: ` WHERE ${compiled.map((c) => c.sql).join(' AND ')}`, params: compiled.flatMap((c) => c.params) };
  }

  private orderLimitClause(): string {
    let sql = '';
    if (this.orders.length > 0) {
      const parts = this.orders.map((o) => {
        const col = q(o.column);
        return o.ascending ? `(${col} IS NULL) ASC, ${col} ASC` : `(${col} IS NULL) DESC, ${col} DESC`;
      });
      sql += ` ORDER BY ${parts.join(', ')}`;
    }
    if (this.limitCount !== null) sql += ` LIMIT ${Math.max(0, Math.floor(this.limitCount))}`;
    return sql;
  }

  private async runSelect(schema: SchemaMeta, meta: TableMeta): Promise<{ rows: Row[] | null; count: number | null }> {
    const pool = getPool();
    const where = this.whereClause(meta);
    let count: number | null = null;

    if (this.countExact || this.headOnly) {
      const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM ${q(this.table)}${where.sql}`, where.params);
      count = Number(countRows[0]?.cnt ?? 0);
      if (this.headOnly) return { rows: null, count };
    }

    const node = parseSelect(this.selectStr);
    const relations = node.embeds.map((embed) => ({ embed, rel: resolveRelation(schema, this.table, embed) }));

    let columnSql: string;
    if (node.star) {
      columnSql = '*';
    } else {
      const names = new Map<string, string>();
      for (const c of node.columns) names.set(c.alias || c.name, c.alias ? `${q(c.name)} AS ${q(c.alias)}` : q(c.name));
      for (const extra of [...this.requiredColumns, ...relations.map((r) => r.rel.localColumn)]) {
        if (!names.has(extra)) names.set(extra, q(extra));
      }
      columnSql = [...names.values()].join(', ');
    }

    const [result] = await pool.query<RowDataPacket[]>(
      `SELECT ${columnSql} FROM ${q(this.table)}${where.sql}${this.orderLimitClause()}`,
      where.params
    );
    const rows = result.map((r) => ({ ...r })) as Row[];
    await this.attachEmbeds(rows, relations);
    return { rows, count };
  }

  private async attachEmbeds(
    rows: Row[],
    relations: { embed: EmbedNode; rel: ReturnType<typeof resolveRelation> }[]
  ): Promise<void> {
    for (const { embed, rel } of relations) {
      const keys = [...new Set(rows.map((r) => r[rel.localColumn]).filter((v) => v !== null && v !== undefined))];
      const related: Row[] = [];
      for (const part of chunk(keys, IN_CHUNK)) {
        const res = await new QueryBuilder(embed.table)
          .select(embed.inner)
          .withRequiredColumns([rel.remoteColumn])
          .in(rel.remoteColumn, part)
          .execute();
        if (res.error) throw new DbQueryError(res.error.message, res.error.code);
        related.push(...((res.data as Row[]) || []));
      }

      const grouped = new Map<string, Row[]>();
      for (const item of related) {
        const k = String(item[rel.remoteColumn]);
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k)!.push(item);
      }

      for (const row of rows) {
        const matches = grouped.get(String(row[rel.localColumn])) || [];
        row[embed.key] = rel.unique ? matches[0] ?? null : matches;
      }
    }
  }

  private prepareRow(meta: TableMeta, raw: object, addId: boolean): Row {
    const row: Row = {};
    for (const [key, value] of Object.entries((raw || {}) as Row)) {
      if (value === undefined || !meta.has(key)) continue;
      row[key] = value;
    }
    if (addId && meta.has('id') && (row.id === undefined || row.id === null || row.id === '')) {
      row.id = crypto.randomUUID();
    }
    return row;
  }

  private async fetchReturning(schema: SchemaMeta, column: string, values: unknown[]): Promise<Row[]> {
    if (values.length === 0) return [];
    const res = await new QueryBuilder(this.table).select(this.selectStr).in(column, values).execute();
    if (res.error) throw new DbQueryError(res.error.message, res.error.code);
    const rows = (res.data as Row[]) || [];
    const position = new Map(values.map((v, i) => [String(v), i]));
    return rows.sort((a, b) => (position.get(String(a[column])) ?? 0) - (position.get(String(b[column])) ?? 0));
  }

  private async runInsert(schema: SchemaMeta, meta: TableMeta): Promise<Row[] | null> {
    const input: object[] = Array.isArray(this.payload) ? this.payload : [this.payload];
    const rows = input.map((r) => this.prepareRow(meta, r, true));
    if (rows.length === 0) return this.returning ? [] : null;

    const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    if (columns.length === 0) throw new DbQueryError(`No valid columns to insert into "${this.table}"`, 'PGRST204');

    const params: unknown[] = [];
    const valuesSql = rows
      .map((row) => {
        const cells = columns.map((c) => {
          if (!(c in row)) return 'DEFAULT';
          params.push(convertValue(meta.get(c), row[c]));
          return '?';
        });
        return `(${cells.join(', ')})`;
      })
      .join(', ');

    let sql = `INSERT${this.op === 'upsert' && this.ignoreDuplicates ? ' IGNORE' : ''} INTO ${q(this.table)} (${columns.map(q).join(', ')}) VALUES ${valuesSql}`;

    const conflictColumns = (this.onConflict || 'id').split(',').map((c) => c.trim()).filter(Boolean);
    if (this.op === 'upsert' && !this.ignoreDuplicates) {
      const updatable = columns.filter((c) => c !== 'id' && c !== 'created_at' && !conflictColumns.includes(c));
      const assignments = updatable.length
        ? updatable.map((c) => `${q(c)} = new_row.${q(c)}`).join(', ')
        : `${q(conflictColumns[0])} = new_row.${q(conflictColumns[0])}`;
      sql += ` AS new_row ON DUPLICATE KEY UPDATE ${assignments}`;
    }

    await getPool().query<ResultSetHeader>(sql, params);

    if (!this.returning) return null;
    if (this.op === 'upsert' && conflictColumns.length === 1 && conflictColumns[0] !== 'id') {
      const key = conflictColumns[0];
      return this.fetchReturning(schema, key, rows.map((r) => r[key]).filter((v) => v !== undefined));
    }
    return this.fetchReturning(schema, 'id', rows.map((r) => r.id));
  }

  private requireFilters(action: string): void {
    if (this.conds.length === 0) {
      throw new DbQueryError(`${action} requires a WHERE clause`, '21000');
    }
  }

  private async matchingIds(meta: TableMeta): Promise<unknown[]> {
    const where = this.whereClause(meta);
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT ${q('id')} FROM ${q(this.table)}${where.sql}${this.orderLimitClause()}`,
      where.params
    );
    return rows.map((r) => r.id);
  }

  private async runUpdate(schema: SchemaMeta, meta: TableMeta): Promise<Row[] | null> {
    this.requireFilters('UPDATE');
    const values = this.prepareRow(meta, this.payload, false);
    delete values.id;
    const columns = Object.keys(values);
    const pool = getPool();

    if (!this.returning) {
      if (columns.length === 0) return null;
      const where = this.whereClause(meta);
      const setSql = columns.map((c) => `${q(c)} = ?`).join(', ');
      const setParams = columns.map((c) => convertValue(meta.get(c), values[c]));
      const [header] = await pool.query<ResultSetHeader>(`UPDATE ${q(this.table)} SET ${setSql}${where.sql}`, [...setParams, ...where.params]);
      this.affectedRows = header.affectedRows;
      return null;
    }

    const ids = await this.matchingIds(meta);
    if (ids.length === 0) return [];
    if (columns.length > 0) {
      const setSql = columns.map((c) => `${q(c)} = ?`).join(', ');
      const setParams = columns.map((c) => convertValue(meta.get(c), values[c]));
      for (const part of chunk(ids, IN_CHUNK)) {
        await pool.query<ResultSetHeader>(
          `UPDATE ${q(this.table)} SET ${setSql} WHERE ${q('id')} IN (${part.map(() => '?').join(', ')})`,
          [...setParams, ...part]
        );
      }
    }
    return this.fetchReturning(schema, 'id', ids);
  }

  private async runDelete(schema: SchemaMeta, meta: TableMeta): Promise<Row[] | null> {
    this.requireFilters('DELETE');
    const pool = getPool();
    if (!this.returning) {
      const where = this.whereClause(meta);
      await pool.query<ResultSetHeader>(`DELETE FROM ${q(this.table)}${where.sql}`, where.params);
      return null;
    }
    const ids = await this.matchingIds(meta);
    const deleted = await this.fetchReturning(schema, 'id', ids);
    for (const part of chunk(ids, IN_CHUNK)) {
      await pool.query<ResultSetHeader>(
        `DELETE FROM ${q(this.table)} WHERE ${q('id')} IN (${part.map(() => '?').join(', ')})`,
        part
      );
    }
    return deleted;
  }
}

export const db = {
  from(table: string): QueryBuilder {
    return new QueryBuilder(table);
  },
};
