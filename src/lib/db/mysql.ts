// =============================================================================
// AEMS v2 — MySQL (Amazon RDS) connection pool + schema metadata cache
// =============================================================================

import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { env } from '@/lib/env';

export interface ColumnMeta {
  name: string;
  dataType: string;
}

export interface ForeignKeyMeta {
  table: string;
  column: string;
  refTable: string;
  refColumn: string;
}

export interface SchemaMeta {
  tables: Map<string, Map<string, ColumnMeta>>;
  foreignKeys: ForeignKeyMeta[];
  uniqueColumns: Set<string>;
}

// Relations used by embeds that intentionally have no FK constraint in the schema.
const EXTRA_RELATIONS: ForeignKeyMeta[] = [
  { table: 'audit_logs', column: 'user_id', refTable: 'users', refColumn: 'id' },
];

const globalRef = globalThis as unknown as {
  __aems_mysql_pool?: Pool;
  __aems_mysql_lock_pool?: Pool;
  __aems_mysql_schema?: Promise<SchemaMeta>;
};

/**
 * Separate small pool that only holds GET_LOCK sessions. Lock holders run their
 * queries on the main pool, so locks can never starve the main pool of connections.
 */
export function getLockPool(): Pool {
  if (!globalRef.__aems_mysql_lock_pool) {
    globalRef.__aems_mysql_lock_pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      ssl: env.db.ssl ? 'Amazon RDS' : undefined,
      waitForConnections: true,
      connectionLimit: 4,
      queueLimit: 0,
      enableKeepAlive: true,
    });
  }
  return globalRef.__aems_mysql_lock_pool;
}

export function getPool(): Pool {
  if (!globalRef.__aems_mysql_pool) {
    globalRef.__aems_mysql_pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      ssl: env.db.ssl ? 'Amazon RDS' : undefined,
      waitForConnections: true,
      connectionLimit: env.db.connectionLimit,
      queueLimit: 0,
      enableKeepAlive: true,
      charset: 'utf8mb4',
      timezone: 'Z',
      decimalNumbers: true,
      typeCast(field, next) {
        if (field.type === 'TINY' && field.length === 1) {
          const v = field.string();
          return v === null ? null : v === '1';
        }
        if (field.type === 'DATETIME' || field.type === 'TIMESTAMP') {
          const v = field.string();
          if (v === null) return null;
          const d = new Date(v.replace(' ', 'T') + 'Z');
          return isNaN(d.getTime()) ? v : d.toISOString();
        }
        if (field.type === 'DATE') {
          return field.string();
        }
        return next();
      },
    });
  }
  return globalRef.__aems_mysql_pool;
}

async function loadSchema(): Promise<SchemaMeta> {
  const pool = getPool();

  const [columnRows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, DATA_TYPE AS d
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()`
  );
  const [fkRows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, REFERENCED_TABLE_NAME AS rt, REFERENCED_COLUMN_NAME AS rc
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`
  );
  const [indexRows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS t, INDEX_NAME AS i, COLUMN_NAME AS c, NON_UNIQUE AS nu
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()`
  );

  const tables = new Map<string, Map<string, ColumnMeta>>();
  for (const row of columnRows) {
    const table = String(row.t);
    if (!tables.has(table)) tables.set(table, new Map());
    tables.get(table)!.set(String(row.c), { name: String(row.c), dataType: String(row.d).toLowerCase() });
  }

  const foreignKeys: ForeignKeyMeta[] = fkRows.map((row) => ({
    table: String(row.t),
    column: String(row.c),
    refTable: String(row.rt),
    refColumn: String(row.rc),
  }));
  for (const rel of EXTRA_RELATIONS) {
    if (!foreignKeys.some((fk) => fk.table === rel.table && fk.column === rel.column)) {
      foreignKeys.push(rel);
    }
  }

  const indexColumns = new Map<string, { unique: boolean; columns: string[] }>();
  for (const row of indexRows) {
    const key = `${row.t}.${row.i}`;
    if (!indexColumns.has(key)) indexColumns.set(key, { unique: Number(row.nu) === 0, columns: [] });
    indexColumns.get(key)!.columns.push(`${row.t}.${row.c}`);
  }
  const uniqueColumns = new Set<string>();
  for (const idx of indexColumns.values()) {
    if (idx.unique && idx.columns.length === 1) uniqueColumns.add(idx.columns[0]);
  }

  return { tables, foreignKeys, uniqueColumns };
}

export function getSchema(): Promise<SchemaMeta> {
  if (!globalRef.__aems_mysql_schema) {
    globalRef.__aems_mysql_schema = loadSchema().catch((err) => {
      globalRef.__aems_mysql_schema = undefined;
      throw err;
    });
  }
  return globalRef.__aems_mysql_schema;
}
