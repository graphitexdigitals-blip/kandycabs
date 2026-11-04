type Listener = (agreed: boolean) => void;

const listeners: Set<Listener> = new Set();

export const termsAgreementState = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  setAgreed(agreed: boolean) {
    listeners.forEach((fn) => {
      try {
        fn(agreed);
      } catch (err) {
        console.warn('termsAgreementState listener error:', err);
      }
    });
  },
};
