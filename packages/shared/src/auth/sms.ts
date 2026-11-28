export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const MSG91_OTP_URL = 'https://control.msg91.com/api/v5/otp';
const MSG91_TIMEOUT_MS = 10_000;

/**
 * Sends a login OTP by SMS through MSG91.
 *
 * - Outside production the OTP is only logged, MSG91 is never called.
 * - In production MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required. If either
 *   is missing the send fails, so the caller can tell the user instead of
 *   pretending an SMS went out.
 * - MSG91 whitelists by server IP, so production traffic must leave from the
 *   whitelisted (static) outbound IP.
 */
export async function sendOtpSms(
  phone: string,
  otp: string,
  options: { expiryMinutes?: number } = {}
): Promise<SmsSendResult> {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.log(`\x1b[33m[SMS DISPATCH - DEV]\x1b[0m Sending OTP ${otp} to ${phone}`);
    return { success: true, messageId: `dev-sms-${Date.now()}` };
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  if (!authKey || !templateId) {
    console.error('[SMS] MSG91_AUTH_KEY and MSG91_TEMPLATE_ID must be set in production');
    return { success: false, error: 'SMS service is not configured' };
  }

  // MSG91 expects the number with country code and no "+", e.g. 919876543210
  const digits = phone.replace(/\D/g, '');
  const mobile = digits.length === 10 ? `91${digits}` : digits;

  const params = new URLSearchParams({
    template_id: templateId,
    mobile,
    otp,
    otp_expiry: String(options.expiryMinutes ?? 5),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MSG91_TIMEOUT_MS);

  try {
    const response = await fetch(`${MSG91_OTP_URL}?${params.toString()}`, {
      method: 'POST',
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: controller.signal,
    });

    const text = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      // non-JSON body, handled below
    }

    // MSG91 answers {"type":"success","request_id":"..."} or {"type":"error","message":"..."}
    if (!response.ok || data.type !== 'success') {
      const reason = data.message || text || `HTTP ${response.status}`;
      console.error('[SMS] MSG91 error:', reason);
      return { success: false, error: String(reason) };
    }

    return { success: true, messageId: data.request_id || data.message };
  } catch (err: any) {
    const timedOut = err?.name === 'AbortError';
    console.error('[SMS] Failed to send OTP via MSG91:', timedOut ? 'timeout' : err);
    return {
      success: false,
      error: timedOut ? 'SMS service timed out' : err?.message || 'SMS service unavailable',
    };
  } finally {
    clearTimeout(timer);
  }
}
