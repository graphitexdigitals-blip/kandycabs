/**
 * One place for the rules about when a login OTP may be bypassed or revealed,
 * so the admin and web send/verify routes cannot drift apart.
 *
 * - Outside production: the dev OTPs (1234 / 0000) work and the real OTP is
 *   returned as `debugOtp`, which is what local development relies on.
 * - In production: neither happens, except for the fixed test accounts below
 *   and only when ALLOW_TEST_ACCOUNTS=true is set explicitly.
 */

const TEST_ACCOUNT_PHONES = ['9999999999', '8888888888', '9587425635'];
const BYPASS_OTPS = ['1234', '0000'];

export const OTP_SEND_LIMIT = 5;
export const OTP_SEND_WINDOW_MS = 15 * 60 * 1000;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isTestAccountPhone(phone: string): boolean {
  const last10 = (phone || '').replace(/\D/g, '').slice(-10);
  return TEST_ACCOUNT_PHONES.includes(last10);
}

/** True when this phone may use fixed OTPs and skip the real SMS. */
export function isTestAccountAllowed(phone: string): boolean {
  if (!isProduction()) return isTestAccountPhone(phone);
  return isTestAccountPhone(phone) && process.env.ALLOW_TEST_ACCOUNTS === 'true';
}

/** True when the submitted OTP is a dev/test OTP that should be accepted without checking the database. */
export function canBypassOtp(phone: string, otp: string): boolean {
  if (!BYPASS_OTPS.includes((otp || '').trim())) return false;
  return !isProduction() || isTestAccountAllowed(phone);
}

/** True when the send-otp response may include the plain OTP (`debugOtp`). */
export function shouldExposeDebugOtp(phone: string): boolean {
  return !isProduction() || isTestAccountAllowed(phone);
}
