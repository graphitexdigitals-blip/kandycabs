/**
 * Safe Polyfills for Hermes JavaScript Engine in React Native
 * Resolves startup crash: Error: Failed to construct 'TextDecoder': the 'fatal' option is unsupported.
 */
import 'fast-text-encoding';

const g: any =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof global !== 'undefined'
    ? global
    : typeof window !== 'undefined'
    ? window
    : null;

if (g) {
  if (g.TextDecoder && !g.TextDecoder.__safe_fatal_wrapped) {
    const RawDecoder = g.TextDecoder;
    function SafeTextDecoder(this: any, label?: string, options?: any) {
      const safeOptions = options ? { ...options, fatal: false } : undefined;
      if (!(this instanceof SafeTextDecoder)) {
        return new (RawDecoder as any)(label, safeOptions);
      }
      return new RawDecoder(label, safeOptions);
    }
    SafeTextDecoder.prototype = RawDecoder.prototype;
    SafeTextDecoder.__safe_fatal_wrapped = true;

    const rawDecode = RawDecoder.prototype.decode;
    if (typeof rawDecode === 'function' && !rawDecode.__safe_stream_wrapped) {
      RawDecoder.prototype.decode = function (input?: any, options?: any) {
        const safeOptions = options ? { ...options, stream: false } : undefined;
        return rawDecode.call(this, input, safeOptions);
      };
      (RawDecoder.prototype.decode as any).__safe_stream_wrapped = true;
    }

    g.TextDecoder = SafeTextDecoder;
  }

  if (g.TextEncoder) {
    const RawEncoder = g.TextEncoder;
    const rawEncode = RawEncoder.prototype.encode;
    if (typeof rawEncode === 'function' && !rawEncode.__safe_stream_wrapped) {
      RawEncoder.prototype.encode = function (input?: any, options?: any) {
        const safeOptions = options ? { ...options, stream: false } : undefined;
        return rawEncode.call(this, input, safeOptions);
      };
      (RawEncoder.prototype.encode as any).__safe_stream_wrapped = true;
    }
  }
}
