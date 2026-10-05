// =============================================================================
// AEMS v2 — Strict Environment Variable Validator
// Fails loudly on boot if any required security key is missing.
// =============================================================================

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
  connectionLimit: number;
}

export interface EnvConfig {
  db: DbConfig;
  sessionSecret: string;
  appUrl: string;
  isMockMode: boolean;
  cookieSecure: boolean;
  smtpEmail?: string;
  smtpPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
  otpFromEmail?: string;
}

function getValidatedEnv(): EnvConfig {
  const isMockMode = process.env.AEMS_MOCK_MODE === 'true';

  const db: DbConfig = {
    host: process.env.DB_HOST || '',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    ssl: process.env.DB_SSL === 'true',
    connectionLimit: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE, 10) : 10,
  };
  const sessionSecret = process.env.SESSION_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const cookieSecure = process.env.SESSION_COOKIE_SECURE === 'true';

  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const otpFromEmail = process.env.OTP_FROM_EMAIL || smtpEmail;

  const shared = { appUrl, cookieSecure, smtpEmail, smtpPassword, smtpHost, smtpPort, otpFromEmail };

  if (isMockMode && process.env.NODE_ENV === 'production') {
    throw new Error('[AEMS v2 FATAL] AEMS_MOCK_MODE=true is not allowed in production. Remove it from the environment.');
  }

  // If mock mode is explicitly true, allow running for local offline UI demo
  if (isMockMode) {
    return {
      ...shared,
      db,
      sessionSecret: sessionSecret || 'mock-session-secret-for-development-mode-only',
      isMockMode: true,
    };
  }

  const missing: string[] = [];
  if (!db.host) missing.push('DB_HOST');
  if (!db.user) missing.push('DB_USER');
  if (!db.database) missing.push('DB_NAME');
  if (!sessionSecret) missing.push('SESSION_SECRET');

  if (missing.length > 0) {
    // If running in development without credentials, default to mock mode with loud console warning
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `\x1b[33m[AEMS v2 WARNING]\x1b[0m Missing env variables: ${missing.join(', ')}. ` +
        `Running in DEMO MOCK MODE. Set these in .env.local to connect to MySQL.`
      );
      return {
        ...shared,
        db,
        sessionSecret: sessionSecret || 'demo-secret-key-32-chars-minimum-pgel',
        isMockMode: true,
      };
    }

    throw new Error(
      `\n====================================================================\n` +
      `[AEMS v2 FATAL STARTUP ERROR] Missing Required Environment Variables:\n` +
      missing.map((key) => ` - ${key}`).join('\n') +
      `\nCheck your .env.local file or deployment environment settings.` +
      `\n====================================================================\n`
    );
  }

  return {
    ...shared,
    db,
    sessionSecret: sessionSecret!,
    isMockMode: false,
  };
}

export const env = getValidatedEnv();
