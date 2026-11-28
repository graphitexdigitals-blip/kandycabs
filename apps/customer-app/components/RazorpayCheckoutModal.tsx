import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Platform,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

export interface RazorpayOrderPayload {
  orderId: string;
  keyId: string;
  amount: number;
  bookingId: string;
  bookingRef: string;
  name: string;
  phone: string;
  email: string;
  callbackUrl?: string;
}

interface RazorpayCheckoutModalProps {
  visible: boolean;
  orderData: RazorpayOrderPayload | null;
  onSuccess: (paymentData: {
    paymentId: string;
    orderId: string;
    signature?: string;
    bookingId?: string;
  }) => void;
  onFailure: (errorData: { code?: string; description?: string }) => void;
  onClose: () => void;
}

function buildRazorpayCheckoutHtml(data: RazorpayOrderPayload): string {
  const amountPaise = Math.round(data.amount * 100);
  const cleanPhone = (data.phone || '').replace(/\D/g, '').slice(-10);
  const formattedPhone = cleanPhone ? `+91${cleanPhone}` : '+919999999999';
  const safeName = (data.name || 'Valued Customer').replace(/'/g, "\\'");
  const safeEmail = (data.email || 'customer@kandycabs.com').replace(/'/g, "\\'");
  const safeRef = (data.bookingRef || 'Booking').replace(/'/g, "\\'");
  const safeCallbackUrl = (data.callbackUrl || `http://10.0.2.2:3001/api/payments/verify?bookingId=${data.bookingId || ''}`).replace(/'/g, "\\'");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Razorpay Secure Checkout</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100%;
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 32px 24px;
      max-width: 340px;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 4px solid rgba(240, 117, 15, 0.15);
      border-top-color: #f0750f;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }
    .title {
      font-size: 19px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .desc {
      font-size: 13px;
      color: #64748b;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #475569;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 999px;
    }
  </style>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
  <div class="card" id="statusCard">
    <div class="spinner"></div>
    <div class="title">Kandy Cabs</div>
    <div class="desc">Connecting to Razorpay Secure Gateway...</div>
    <div class="badge">UPI • Cards • NetBanking • Wallets</div>
  </div>

  <script>
    function notifyRN(msg) {
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    // Force all form submissions (bank redirects, test simulator) to remain in the same window
    try {
      var originalSubmit = HTMLFormElement.prototype.submit;
      HTMLFormElement.prototype.submit = function() {
        this.target = '_self';
        return originalSubmit.call(this);
      };
    } catch(e) {}

    // Polyfill window.open to keep bank authentication and test simulator in current WebView
    var originalOpen = window.open;
    window.open = function(url, target, features) {
      if (url && url !== 'about:blank' && !url.startsWith('javascript:') && !url.includes('about:blank')) {
        window.location.href = url;
      }
      return window;
    };

    // Strip target="_blank" from any dynamically created forms or links
    document.addEventListener('DOMContentLoaded', function() {
      try {
        var observer = new MutationObserver(function() {
          document.querySelectorAll('form[target="_blank"], form:not([target])').forEach(function(f) {
            f.target = '_self';
          });
          document.querySelectorAll('a[target="_blank"]').forEach(function(a) {
            a.target = '_self';
          });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
      } catch(e) {}
    });

    var rzp = null;
    var isPaymentSubmitted = false;

    function launchCheckout() {
      if (typeof Razorpay === 'undefined') {
        setTimeout(launchCheckout, 300);
        return;
      }

      var isRealOrder = ${Boolean(data.orderId && data.orderId.startsWith('order_') && !data.orderId.includes('mock'))};
      var options = {
        key: '${data.keyId}',
        amount: ${amountPaise},
        currency: 'INR',
        name: 'Kandy Cabs',
        description: 'Advance Ride Payment (${safeRef})',
        image: 'https://kandycabs.com/images/logo.png',
        ...(isRealOrder ? { order_id: '${data.orderId}' } : {}),
        redirect: true,
        callback_url: '${safeCallbackUrl}',
        prefill: {
          name: '${safeName}',
          contact: '${formattedPhone}',
          email: '${safeEmail}'
        },
        theme: {
          color: '#f0750f',
          hide_topbar: false
        },
        modal: {
          backdropclose: false,
          escape: false,
          handleback: false,
          confirm_close: false,
          ondismiss: function() {
            console.log('[Razorpay Modal] Dismiss event');
          }
        },
        handler: function(response) {
          isPaymentSubmitted = true;
          try {
            var card = document.getElementById('statusCard');
            if (card) {
              card.style.display = 'flex';
              card.innerHTML = '<div class="spinner"></div><div class="title">Payment Processing!</div><div class="desc">Verifying transaction & confirming ride...</div>';
            }
          } catch(e) {}
          notifyRN({
            type: 'PAYMENT_SUCCESS',
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
            bookingId: '${data.bookingId || ''}'
          });
        }
      };

      try {
        rzp = new Razorpay(options);
        rzp.on('payment.failed', function(resp) {
          notifyRN({
            type: 'PAYMENT_FAILED',
            code: resp.error ? resp.error.code : 'UNKNOWN',
            description: resp.error ? resp.error.description : 'Payment not completed'
          });
        });
        rzp.open();
        try {
          var card = document.getElementById('statusCard');
          if (card) card.style.display = 'none';
        } catch(e) {}
      } catch (err) {
        notifyRN({ type: 'PAYMENT_FAILED', description: err.message || 'Error launching Razorpay checkout' });
      }
    }

    if (document.readyState === 'complete') {
      launchCheckout();
    } else {
      window.addEventListener('load', launchCheckout);
    }
  </script>
</body>
</html>`;
}

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  visible,
  orderData,
  onSuccess,
  onFailure,
  onClose,
}) => {
  const webViewRef = React.useRef<WebView>(null);
  if (!visible || !orderData) return null;

  const apiBase = orderData.callbackUrl
    ? orderData.callbackUrl.split('/api/')[0]
    : 'http://10.0.2.2:3001';

  const checkoutUrl = `${apiBase}/checkout/razorpay?orderId=${encodeURIComponent(
    orderData.orderId || ''
  )}&amount=${orderData.amount}&keyId=${encodeURIComponent(
    orderData.keyId
  )}&bookingId=${encodeURIComponent(
    orderData.bookingId
  )}&ref=${encodeURIComponent(
    orderData.bookingRef || 'Booking'
  )}&name=${encodeURIComponent(
    orderData.name || 'Customer'
  )}&phone=${encodeURIComponent(
    orderData.phone || ''
  )}&email=${encodeURIComponent(
    orderData.email || 'customer@kandycabs.com'
  )}`;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Top Header Bar with Close Button */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeIconButton}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={22} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitleText}>Razorpay Gateway</Text>
            <Text style={styles.headerSubtitleText}>₹{orderData.amount} Advance • {orderData.bookingRef}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeIconButton}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close-circle-outline" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        <WebView
          ref={webViewRef}
          style={styles.webview}
          source={{
            html: buildRazorpayCheckoutHtml(orderData),
            baseUrl: 'https://checkout.razorpay.com',
          }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          thirdPartyCookiesEnabled={true}
          sharedCookiesEnabled={true}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={true}
          mixedContentMode="always"
          allowsInlineMediaPlayback={true}
          userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
          onOpenWindow={(syntheticEvent) => {
            const { targetUrl } = syntheticEvent.nativeEvent;
            if (targetUrl && targetUrl !== 'about:blank' && !targetUrl.includes('about:blank')) {
              webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(targetUrl)};`);
            }
          }}
          onShouldStartLoadWithRequest={(request) => {
            const { url } = request;
            if (!url) return true;
            if (url.includes('about:blank#blocked')) {
              return false;
            }
            if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
              Linking.openURL(url).catch((err) => {
                console.warn('[WebView] External app link error:', err);
              });
              return false;
            }
            return true;
          }}
          onError={(e) => console.warn('[WebViewError]', e.nativeEvent)}
          onHttpError={(e) => console.warn('[WebViewHttpError]', e.nativeEvent.statusCode, e.nativeEvent.url)}
          onNavigationStateChange={(navState) => {
            console.log('[WebViewNav]', navState.url, navState.loading, navState.title);
            const url = navState.url;
            if (!url) return;
            if (
              url.includes('booking-confirmed') ||
              (url.includes('/api/payments/verify') && (url.includes('razorpay_payment_id') || url.includes('payment_id')))
            ) {
              try {
                const urlObj = new URL(url);
                const pId = urlObj.searchParams.get('razorpay_payment_id') || urlObj.searchParams.get('paymentId');
                const oId = urlObj.searchParams.get('razorpay_order_id') || urlObj.searchParams.get('orderId');
                const sig = urlObj.searchParams.get('razorpay_signature') || urlObj.searchParams.get('signature');
                if (pId) {
                  onSuccess({
                    paymentId: pId,
                    orderId: oId || orderData.orderId,
                    signature: sig || '',
                    bookingId: orderData.bookingId,
                  });
                }
              } catch (_) {}
            }
          }}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#f0750f" />
              <Text style={styles.loadingTitle}>Connecting to Razorpay...</Text>
              <Text style={styles.loadingSubtitle}>
                UPI (Google Pay, PhonePe, Paytm) • Cards • NetBanking
              </Text>
            </View>
          )}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'PAYMENT_SUCCESS') {
                onSuccess({
                  paymentId: data.paymentId,
                  orderId: data.orderId || orderData.orderId,
                  signature: data.signature,
                  bookingId: data.bookingId || orderData.bookingId,
                });
              } else if (data.type === 'PAYMENT_FAILED') {
                onFailure({
                  code: data.code,
                  description: data.description || 'Payment was declined or failed.',
                });
              } else if (data.type === 'PAYMENT_CANCELLED') {
                onClose();
              }
            } catch (_) {}
          }}
        />

        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.cancelButton}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={18} color="#64748b" />
            <Text style={styles.cancelText}>Cancel & Return to Bookings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  closeIconButton: {
    padding: 6,
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitleText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  loadingTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 16,
  },
  loadingSubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  bottomBar: {
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'android' ? 24 : 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
});
