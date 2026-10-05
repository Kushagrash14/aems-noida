// =============================================================================
// AEMS v2 — OTP Generation & Verification Subsystem
// Database-backed hashed OTPs (never stored in plain text)
// =============================================================================

import crypto from 'crypto';
import { env } from '@/lib/env';
import { db } from '@/lib/db/client';
import { sendOtpEmail } from '@/lib/mailer';

// In-memory OTP store for mock mode
interface MockOTP {
  id: string;
  email: string;
  otp_hash: string;
  attempts: number;
  is_used: boolean;
  expires_at: number;
  created_at: number;
}
const mockOtpStore: MockOTP[] = ((globalThis as unknown as { __aems_otps?: MockOTP[] }).__aems_otps ??= []);

/**
 * Hash OTP code using SHA-256 and secret salt
 */
export function hashOtp(otp: string, email: string): string {
  return crypto
    .createHmac('sha256', env.sessionSecret)
    .update(`${email.toLowerCase().trim()}:${otp}`)
    .digest('hex');
}

/**
 * Generate a secure 6-digit numeric OTP and store its hash in the database
 */
export async function createAndStoreOtp(email: string): Promise<{ success: boolean; message?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  const otpString = crypto.randomInt(100000, 1000000).toString();
  const hashed = hashOtp(otpString, normalizedEmail);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

  if (env.isMockMode) {
    // Invalidate prior unused OTPs for this email
    mockOtpStore.forEach((o) => {
      if (o.email === normalizedEmail) o.is_used = true;
    });

    mockOtpStore.push({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      otp_hash: hashed,
      attempts: 0,
      is_used: false,
      expires_at: expiresAt.getTime(),
      created_at: Date.now(),
    });

    // Mock mode is refused in production (see env.ts), so this log only ever reaches a local dev terminal.
    console.log(`\x1b[32m[AEMS OTP DISPATCH]\x1b[0m OTP for ${normalizedEmail}: \x1b[1m${otpString}\x1b[0m (Valid for 10 mins)`);

    const mailRes = await sendOtpEmail(normalizedEmail, otpString);
    if (!mailRes.success) {
      console.warn(`[AEMS OTP] SMTP delivery warning in mock mode: ${mailRes.error}`);
    }

    return {
      success: true,
      message: mailRes.success
        ? `OTP sent to ${normalizedEmail} via Office 365 SMTP.`
        : `OTP generated. (SMTP Notice: ${mailRes.error})`,
    };
  }

  try {
    await db
      .from('auth_otps')
      .update({ is_used: true })
      .eq('email', normalizedEmail)
      .eq('is_used', false);

    const { error } = await db.from('auth_otps').insert({
      email: normalizedEmail,
      otp_hash: hashed,
      attempts: 0,
      is_used: false,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      console.error('Error saving OTP:', error);
      return { success: false, message: `Could not generate OTP. Please try again. (${error.code})` };
    }

    const emailResult = await sendOtpEmail(normalizedEmail, otpString);
    if (!emailResult.success) {
      console.error(`[AEMS OTP] SMTP dispatch failed for ${normalizedEmail}: ${emailResult.error}`);
      return {
        success: false,
        message: 'The verification email could not be delivered. Please try again or contact your IT Admin.',
      };
    }

    return {
      success: true,
      message: `OTP verification code sent to ${normalizedEmail}`,
    };
  } catch (err) {
    console.error('OTP creation exception:', err);
    return { success: false, message: 'Internal server error while creating OTP' };
  }
}

/**
 * Verify provided OTP against stored hash
 */
export async function verifyOtp(
  email: string,
  enteredOtp: string
): Promise<{ success: boolean; message?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const calculatedHash = hashOtp(String(enteredOtp).trim(), normalizedEmail);

  if (env.isMockMode) {
    const record = mockOtpStore
      .filter((o) => o.email === normalizedEmail && !o.is_used)
      .sort((a, b) => b.created_at - a.created_at)[0];

    if (!record) {
      return { success: false, message: 'No active OTP request found. Please request a new code.' };
    }

    if (Date.now() > record.expires_at) {
      record.is_used = true;
      return { success: false, message: 'OTP has expired. Please request a new code.' };
    }

    if (record.attempts >= 3) {
      record.is_used = true;
      return { success: false, message: 'Too many invalid attempts. Please request a new code.' };
    }

    if (record.otp_hash !== calculatedHash) {
      record.attempts += 1;
      return { success: false, message: `Invalid OTP code. ${3 - record.attempts} attempts remaining.` };
    }

    record.is_used = true;
    return { success: true };
  }

  try {
    const { data: records, error } = await db
      .from('auth_otps')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !records || records.length === 0) {
      return { success: false, message: 'No active OTP found. Please request a new code.' };
    }

    const otpRecord = records[0];

    if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
      await db.from('auth_otps').update({ is_used: true }).eq('id', otpRecord.id);
      return { success: false, message: 'OTP has expired. Please request a new code.' };
    }

    if (otpRecord.attempts >= 3) {
      await db.from('auth_otps').update({ is_used: true }).eq('id', otpRecord.id);
      return { success: false, message: 'Too many invalid attempts. Please request a new code.' };
    }

    if (otpRecord.otp_hash !== calculatedHash) {
      const attempts = otpRecord.attempts + 1;
      await db
        .from('auth_otps')
        .update({ attempts, is_used: attempts >= 3 })
        .eq('id', otpRecord.id);
      return { success: false, message: `Invalid code. ${Math.max(0, 3 - attempts)} attempts remaining.` };
    }

    await db.from('auth_otps').update({ is_used: true }).eq('id', otpRecord.id);
    return { success: true };
  } catch (err) {
    console.error('OTP verification exception:', err);
    return { success: false, message: 'Failed to verify OTP' };
  }
}
