// Safely patch Global Response, Fetch & XMLHttpRequest in React Native Hermes/JSC environments
// to prevent whatwg-fetch crash on network status 0: "Failed to construct 'Response': The status provided (0) is outside the range [200, 599]"

const targetGlobal: any =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof global !== 'undefined'
    ? global
    : typeof window !== 'undefined'
    ? window
    : null;

// 1. Polyfill TextDecoder / TextEncoder if missing in Hermes / React Native environment
if (targetGlobal) {
  if (typeof targetGlobal.TextDecoder === 'undefined' || typeof targetGlobal.TextEncoder === 'undefined') {
    try {
      require('fast-text-encoding');
    } catch (_) {}
  }
}

// 2. Coerce XMLHttpRequest status 0 on load events to prevent RangeError in whatwg-fetch
if (targetGlobal && targetGlobal.XMLHttpRequest) {
  const OriginalXHR = targetGlobal.XMLHttpRequest;
  const originalDispatch = OriginalXHR.prototype.dispatchEvent;
  if (originalDispatch && !OriginalXHR.__status0_patched) {
    OriginalXHR.__status0_patched = true;
    OriginalXHR.prototype.dispatchEvent = function (event: any) {
      if (event && (event.type === 'load' || event.type === 'loadend' || event.type === 'readystatechange')) {
        if (this.readyState === 4 && this.status === 0) {
          try {
            this.status = 503;
            this.statusText = 'Service Unavailable / Network Offline';
          } catch (_) {}
        }
      }
      return originalDispatch.call(this, event);
    };
  }
}

// 3. Wrap Response constructor so status outside [200, 599] never throws
if (targetGlobal && targetGlobal.Response) {
  const OriginalResponse = targetGlobal.Response;
  let needsPatch = false;

  try {
    // Test if native Response throws when status is 0
    new OriginalResponse(null, { status: 0 as any });
  } catch (_) {
    needsPatch = true;
  }

  if (needsPatch) {
    const SafeResponse = function (this: any, body?: any, init?: ResponseInit) {
      if (init && typeof init.status === 'number' && (init.status < 200 || init.status > 599)) {
        init = {
          ...init,
          status: init.status === 0 ? 503 : Math.min(Math.max(init.status, 200), 599),
          statusText: init.statusText || (init.status === 0 ? 'Network Error' : 'Unknown'),
        };
      }
      if (!(this instanceof SafeResponse)) {
        return new (OriginalResponse as any)(body, init);
      }
      return new OriginalResponse(body, init);
    };

    SafeResponse.prototype = OriginalResponse.prototype;
    SafeResponse.error = OriginalResponse.error;
    SafeResponse.redirect = OriginalResponse.redirect;
    SafeResponse.json = OriginalResponse.json;

    try {
      targetGlobal.Response = SafeResponse;
    } catch (_) {}
  }
}

// 4. Wrap fetch to catch any residual RangeError from async timer callbacks
if (targetGlobal && targetGlobal.fetch && !targetGlobal.fetch.__safe_wrapped) {
  const originalFetch = targetGlobal.fetch;
  const safeFetch = async function (...args: any[]) {
    try {
      const res = await originalFetch.apply(targetGlobal, args);
      if (res && typeof res.status === 'number' && (res.status < 200 || res.status > 599)) {
        if (res.status === 0) {
          throw new TypeError('Network request failed: status 0');
        }
      }
      return res;
    } catch (err: any) {
      if (
        err?.message?.includes("Failed to construct 'Response'") ||
        err?.message?.includes('outside the range [200, 599]')
      ) {
        throw new TypeError('Network request failed: connection lost');
      }
      throw err;
    }
  };
  safeFetch.__safe_wrapped = true;
  targetGlobal.fetch = safeFetch;
}

export {};
