// =============================================================================
// AEMS v2 — Single Active Session Subsystem
// Enforces single-device-login, kickouts, and role-based idle timeouts.
// Sessions live in MySQL (user_sessions); mock mode keeps them in memory.
// =============================================================================

import crypto from 'crypto';
import { env } from '@/lib/env';
import { User, UserScope, UserSession, Department } from '@/types/database';
import { db } from '@/lib/db/client';
import { SEED_USERS, SEED_SCOPES } from '@/lib/mock-data';
import { getInactivityTimeoutSeconds } from '@/lib/permissions';

export const SESSION_COOKIE_NAME = 'aems_session_token';

// In-memory sessions store for mock mode
interface MockSession {
  id: string;
  user_id: string;
  session_token_hash: string;
  device_info: string;
  ip_address: string;
  last_activity_at: number;
  expires_at: number;
  is_active: boolean;
  created_at: number;
}
const mockSessionsStore: MockSession[] = ((globalThis as unknown as { __aems_sessions?: MockSession[] }).__aems_sessions ??= []);

interface CachedSessionValidation {
  result: SessionValidationResult;
  expiresAt: number;
}
const sessionValidationCache: Map<string, CachedSessionValidation> = ((globalThis as unknown as { __aems_session_cache?: Map<string, CachedSessionValidation> }).__aems_session_cache ??= new Map());

const SESSION_CACHE_TTL_MS = 25_000;

/**
 * Hash a session token before storing in database
 */
export function hashSessionToken(token: string): string {
  return crypto.createHmac('sha256', env.sessionSecret).update(token).digest('hex');
}

/**
 * Create a new single-active session for a user.
 * Immediately terminates all previous active sessions for this user.
 */
export async function createActiveSession(
  user: User,
  clientInfo: { ip?: string; userAgent?: string }
): Promise<{ rawToken: string; session: UserSession }> {
  // Generate high-entropy 256-bit cryptographic token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);

  const timeoutSeconds = getInactivityTimeoutSeconds(user.role);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + timeoutSeconds * 1000);
  const deviceInfo = (clientInfo.userAgent || 'Unknown Device').slice(0, 1000);
  const ipAddress = (clientInfo.ip || '127.0.0.1').slice(0, 100);

  if (env.isMockMode) {
    mockSessionsStore.forEach((s) => {
      if (s.user_id === user.id && s.is_active) s.is_active = false;
    });

    const memorySession: MockSession = {
      id: crypto.randomUUID(),
      user_id: user.id,
      session_token_hash: tokenHash,
      device_info: deviceInfo,
      ip_address: ipAddress,
      last_activity_at: now.getTime(),
      expires_at: expiresAt.getTime(),
      is_active: true,
      created_at: now.getTime(),
    };
    mockSessionsStore.push(memorySession);

    return {
      rawToken,
      session: {
        id: memorySession.id,
        user_id: memorySession.user_id,
        session_token_hash: memorySession.session_token_hash,
        device_info: memorySession.device_info,
        ip_address: memorySession.ip_address,
        last_activity_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
        created_at: now.toISOString(),
      },
    };
  }

  // Kick out all previous sessions for this user
  await db
    .from('user_sessions')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('is_active', true);

  const { data, error } = await db
    .from('user_sessions')
    .insert({
      user_id: user.id,
      session_token_hash: tokenHash,
      device_info: deviceInfo,
      ip_address: ipAddress,
      last_activity_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Could not create session: ${error?.message || 'unknown error'}`);
  }

  await db.from('users').update({ last_login_at: now.toISOString() }).eq('id', user.id);
  sessionValidationCache.clear();

  return { rawToken, session: data as UserSession };
}

export interface SessionValidationResult {
  valid: boolean;
  reason?: 'missing_token' | 'kicked_out' | 'idle_timeout' | 'user_inactive' | 'error';
  user?: User;
  scope?: UserScope | null;
  session?: UserSession;
}

function resolveUserOrgUnits(user: User, scope: UserScope | null, adminDeptId: string | null): void {
  const assignedDeptId = user.department_id || scope?.department_ids?.[0] || scope?.category_ids?.[0] || adminDeptId || null;
  user.location_id = user.location_id || scope?.location_ids?.[0] || null;
  user.plant_id = user.plant_id || scope?.plant_ids?.[0] || null;
  user.department_id = assignedDeptId;

  if (scope) {
    if (assignedDeptId && (!scope.department_ids || scope.department_ids.length === 0)) {
      scope.department_ids = [assignedDeptId];
    }
    scope.category_ids = null;
  }
}

/**
 * Validates active session token, evaluates inactivity timeout & single session exclusivity.
 */
export async function validateSessionToken(rawToken?: string): Promise<SessionValidationResult> {
  if (!rawToken) {
    return { valid: false, reason: 'missing_token' };
  }

  const tokenHash = hashSessionToken(rawToken);
  const now = Date.now();

  const cached = sessionValidationCache.get(tokenHash);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  if (env.isMockMode) {
    return validateMockSession(tokenHash, now);
  }

  try {
    const { data: sessionData, error } = await db
      .from('user_sessions')
      .select('*, users(*)')
      .eq('session_token_hash', tokenHash)
      .maybeSingle();

    if (error) {
      console.error('[AEMS Session] Session lookup failed:', error.message);
      return { valid: false, reason: 'error' };
    }
    if (!sessionData) return { valid: false, reason: 'missing_token' };
    if (!sessionData.is_active) return { valid: false, reason: 'kicked_out' };

    const user = sessionData.users as User | null;
    if (!user || !user.is_active) return { valid: false, reason: 'user_inactive' };

    const lastActivity = new Date(sessionData.last_activity_at).getTime();
    const maxIdleMs = getInactivityTimeoutSeconds(user.role) * 1000;
    if (now - lastActivity > maxIdleMs) {
      await db.from('user_sessions').update({ is_active: false }).eq('id', sessionData.id);
      return { valid: false, reason: 'idle_timeout' };
    }

    await db
      .from('user_sessions')
      .update({
        last_activity_at: new Date(now).toISOString(),
        expires_at: new Date(now + maxIdleMs).toISOString(),
      })
      .eq('id', sessionData.id);

    const { data: scopeData } = await db
      .from('user_scopes')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    const scope = (scopeData as UserScope | null) || null;

    let adminDeptId: string | null = null;
    if (!user.department_id && !scope?.department_ids?.[0] && !scope?.category_ids?.[0]) {
      const { data: deptData } = await db
        .from('departments')
        .select('id')
        .eq('admin_user_id', user.id)
        .limit(1)
        .maybeSingle();
      adminDeptId = deptData?.id || null;
    }

    resolveUserOrgUnits(user, scope, adminDeptId);

    const { users: _embeddedUser, ...session } = sessionData;
    void _embeddedUser;
    const res: SessionValidationResult = { valid: true, user, scope, session: session as UserSession };
    sessionValidationCache.set(tokenHash, { result: res, expiresAt: now + SESSION_CACHE_TTL_MS });
    return res;
  } catch (err) {
    console.error('[AEMS Session] Validation error:', err);
    return { valid: false, reason: 'error' };
  }
}

function validateMockSession(tokenHash: string, now: number): SessionValidationResult {
  const s = mockSessionsStore.find((item) => item.session_token_hash === tokenHash);
  if (!s) return { valid: false, reason: 'missing_token' };
  if (!s.is_active) return { valid: false, reason: 'kicked_out' };

  const memory = (globalThis as unknown as { __aems_memory?: { users: User[]; userScopes: UserScope[]; departments: Department[] } }).__aems_memory;
  const user = memory?.users?.find((u) => u.id === s.user_id) || SEED_USERS.find((u) => u.id === s.user_id);
  if (!user || !user.is_active) return { valid: false, reason: 'user_inactive' };

  const maxIdleMs = getInactivityTimeoutSeconds(user.role) * 1000;
  if (now - s.last_activity_at > maxIdleMs) {
    s.is_active = false;
    return { valid: false, reason: 'idle_timeout' };
  }

  s.last_activity_at = now;
  s.expires_at = now + maxIdleMs;

  const scope = memory?.userScopes?.find((sc) => sc.user_id === user.id) || SEED_SCOPES.find((sc) => sc.user_id === user.id) || null;
  const adminDeptId = memory?.departments?.find((d) => d.admin_user_id === user.id)?.id || null;
  resolveUserOrgUnits(user, scope, adminDeptId);

  return {
    valid: true,
    user,
    scope,
    session: {
      id: s.id,
      user_id: s.user_id,
      session_token_hash: s.session_token_hash,
      device_info: s.device_info,
      ip_address: s.ip_address,
      last_activity_at: new Date(s.last_activity_at).toISOString(),
      expires_at: new Date(s.expires_at).toISOString(),
      is_active: true,
      created_at: new Date(s.created_at).toISOString(),
    },
  };
}

/**
 * Terminate a session on explicit logout
 */
export async function terminateSession(rawToken?: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  sessionValidationCache.delete(tokenHash);

  if (env.isMockMode) {
    const s = mockSessionsStore.find((item) => item.session_token_hash === tokenHash);
    if (s) s.is_active = false;
    return;
  }

  await db.from('user_sessions').update({ is_active: false }).eq('session_token_hash', tokenHash);
}

export function invalidateSessionValidationCache(): void {
  sessionValidationCache.clear();
}
