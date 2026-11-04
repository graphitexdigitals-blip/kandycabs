/**
 * KANDY CABS - Centralized Support & Help Center Configuration
 * Single source of truth for contact details, emergency lines, FAQ database, and help categories.
 */

export interface ContactChannel {
  id: 'call' | 'whatsapp' | 'email' | 'app_support';
  title: string;
  value: string;
  displayValue: string;
  subtitle: string;
  icon: string;
  iconFamily: 'Ionicons' | 'FontAwesome';
  actionType: 'tel' | 'whatsapp' | 'mailto' | 'form';
}

export interface SupportConfig {
  phone: string;
  phoneDisplay: string;
  phoneAvailability: string;
  whatsappPhone: string;
  whatsappDisplay: string;
  whatsappAvailability: string;
  email: string;
  emailAvailability: string;
  appSupportPhone: string;
  appSupportDisplay: string;
  emergencySupportPhone: string;
  policeEmergencyPhone: string;
}

export const SUPPORT_CONFIG: SupportConfig = {
  phone: '+919900887777',
  phoneDisplay: '+91 99008 87777',
  phoneAvailability: '24/7 Toll Free Help',
  whatsappPhone: '919008890090',
  whatsappDisplay: '+91 90088 90090',
  whatsappAvailability: 'Instant WhatsApp Chat',
  email: 'support@kandycabs.com',
  emailAvailability: 'We reply within 2 hours',
  appSupportPhone: '+919187336058',
  appSupportDisplay: '+91 91873 36058',
  emergencySupportPhone: '+919900887777',
  policeEmergencyPhone: '112',
};

export interface HelpCategory {
  id: string;
  label: string;
  icon: string;
  iconFamily: 'Ionicons' | 'FontAwesome' | 'MaterialCommunityIcons';
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'all', label: 'FAQs', icon: 'help-circle-outline', iconFamily: 'Ionicons' },
  { id: 'booking', label: 'Booking Support', icon: 'calendar-outline', iconFamily: 'Ionicons' },
  { id: 'payment', label: 'Payment Issues', icon: 'card-outline', iconFamily: 'Ionicons' },
  { id: 'cancellation', label: 'Cancellation & Refunds', icon: 'close-circle-outline', iconFamily: 'Ionicons' },
  { id: 'driver', label: 'Driver & Trip Support', icon: 'car-sport-outline', iconFamily: 'Ionicons' },
  { id: 'app', label: 'App Support', icon: 'phone-portrait-outline', iconFamily: 'Ionicons' },
  { id: 'contact', label: 'Contact Us', icon: 'people-outline', iconFamily: 'Ionicons' },
];

export interface FAQItem {
  id: string;
  category: 'booking' | 'payment' | 'cancellation' | 'driver' | 'app';
  question: string;
  answer: string;
  tags: string[];
}

export const FAQ_DATA: FAQItem[] = [
  // Booking Support
  {
    id: 'faq-b1',
    category: 'booking',
    question: 'How do I book a cab with KANDY CABS?',
    answer:
      'Open the app, select your pickup and drop-off locations, choose your travel type (One Way, Round Trip, or Local Airport) and preferred vehicle, review the fixed fare and trip details, and proceed to confirmation. Once confirmed, you can track driver assignment in My Bookings.',
    tags: ['book', 'booking', 'reserve', 'how to book', 'ride', 'cab'],
  },
  {
    id: 'faq-b2',
    category: 'booking',
    question: 'How do I select my pickup location?',
    answer:
      'Enter your pickup address in the location search bar or tap the map to pinpoint your exact spot. Check the displayed city, landmark, and building name carefully before confirming your booking.',
    tags: ['pickup', 'location', 'address', 'pin', 'map', 'start'],
  },
  {
    id: 'faq-b3',
    category: 'booking',
    question: 'How do I choose a vehicle?',
    answer:
      'Select from the available vehicle categories displayed for your route (e.g. Sedan, Ertiga, Innova, Crysta). Review seating capacity, luggage capability, AC amenities, and all-inclusive transparent fare before confirming.',
    tags: ['vehicle', 'car', 'sedan', 'ertiga', 'innova', 'crysta', 'suv', 'seating'],
  },
  {
    id: 'faq-b4',
    category: 'booking',
    question: 'Where can I find my booking details?',
    answer:
      'Tap "My Bookings" in the bottom dock at any time to view your booking reference, status, assigned driver details, vehicle registration, travel schedule, and payment summary.',
    tags: ['details', 'my bookings', 'status', 'reference', 'driver details', 'vehicle'],
  },
  {
    id: 'faq-b5',
    category: 'booking',
    question: 'Can I book a cab for someone else?',
    answer:
      'Yes. In the Additional Details step during booking, enter the actual passenger\'s name and mobile number. All trip updates, driver assignment details, and OTP will be sent directly to their phone.',
    tags: ['someone else', 'friend', 'family', 'guest', 'passenger', 'book for other'],
  },

  // Payment Issues
  {
    id: 'faq-p1',
    category: 'payment',
    question: 'How is the fare calculated?',
    answer:
      'Your fare is transparent and all-inclusive. It is calculated based on vehicle class, trip type, total distance/package kilometres, driver allowance, and toll estimates. Review the complete fare breakdown on the summary screen before confirmation.',
    tags: ['fare', 'price', 'pricing', 'cost', 'calculate', 'surge', 'rate'],
  },
  {
    id: 'faq-p2',
    category: 'payment',
    question: 'How can I make a payment?',
    answer:
      'You can pay securely online via UPI, Credit/Debit cards, Net Banking, or pay directly to the driver via cash or UPI upon trip completion, depending on the booking configuration.',
    tags: ['payment', 'pay', 'upi', 'card', 'cash', 'net banking', 'method'],
  },
  {
    id: 'faq-p3',
    category: 'payment',
    question: 'Why did my payment fail?',
    answer:
      'Check your internet connection and bank UPI limits. Do not immediately pay again if the amount may have been debited. Check "My Bookings" first. If the amount was deducted without confirmation, contact Support with your bank transaction UTR reference.',
    tags: ['failed', 'payment failed', 'deducted', 'debited', 'upi failed', 'transaction'],
  },
  {
    id: 'faq-p4',
    category: 'payment',
    question: 'How can I check my advance payment?',
    answer:
      'Open "My Bookings", select your booking card, and review the Payment Breakdown. It displays the advance paid, balance due to the driver, and payment mode.',
    tags: ['advance', 'deposit', 'balance', 'receipt', 'payment status'],
  },
  {
    id: 'faq-p5',
    category: 'payment',
    question: 'Will I get a tax invoice for my booking?',
    answer:
      'Yes. Official GST-compliant tax invoices are automatically generated upon trip completion. You can download your invoice directly from My Bookings or request a copy sent to your email.',
    tags: ['invoice', 'tax', 'bill', 'receipt', 'gst', 'business'],
  },

  // Cancellation and Refunds
  {
    id: 'faq-c1',
    category: 'cancellation',
    question: 'Can I cancel or reschedule my booking?',
    answer:
      'Open "My Bookings", select the active booking, and tap "Cancel Booking" or "Reschedule". Free cancellation is typically available up to 2 hours prior to scheduled departure. Check the policy details on your booking screen.',
    tags: ['cancel', 'cancellation', 'reschedule', 'change date', 'modify'],
  },
  {
    id: 'faq-c2',
    category: 'cancellation',
    question: 'Will I receive a refund after cancellation?',
    answer:
      'If your booking is eligible for a refund under our cancellation policy, the refund is initiated automatically to your original source of payment (UPI, Bank Account, or Card).',
    tags: ['refund', 'money back', 'cancellation refund', 'return'],
  },
  {
    id: 'faq-c3',
    category: 'cancellation',
    question: 'How long does a refund take?',
    answer:
      'UPI and wallet refunds are processed within 24 to 48 hours. Bank account and credit/debit card refunds typically reflect within 3 to 7 business days depending on your issuing bank.',
    tags: ['refund timeline', 'how long', 'days', 'time', 'delay'],
  },

  // Driver and Trip Support
  {
    id: 'faq-d1',
    category: 'driver',
    question: 'How can I contact my assigned driver?',
    answer:
      'Once a driver is assigned (usually 1-2 hours before outstation trips or immediately for instant rides), their name, phone number, vehicle model, and registration plate appear on your active booking card with a direct "Call Driver" button.',
    tags: ['driver', 'contact driver', 'call driver', 'number', 'assigned'],
  },
  {
    id: 'faq-d2',
    category: 'driver',
    question: 'What should I do if my driver is delayed?',
    answer:
      'Check the live trip tracking on the booking card or tap "Call Driver". If the driver is unreachable or delayed beyond 15 minutes, tap "App Support Helpline" or Call Us immediately for backup vehicle dispatch.',
    tags: ['delay', 'late', 'driver late', 'waiting', 'not arrived'],
  },
  {
    id: 'faq-d3',
    category: 'driver',
    question: 'Why do I need to provide an OTP?',
    answer:
      'A unique 4-digit Ride Start OTP protects your safety by ensuring only authorized passengers board the designated cab. Share your OTP with the driver only after verifying the vehicle registration number and sitting safely inside.',
    tags: ['otp', 'pin', 'verification', 'start trip', 'security'],
  },
  {
    id: 'faq-d4',
    category: 'driver',
    question: 'What should I do if the driver or vehicle details do not match?',
    answer:
      'Do NOT board the vehicle if the license plate or driver differs from your booking card. Call our 24x7 Customer Helpline (+91 99008 87777) immediately. For immediate personal danger, press Emergency SOS or call 112.',
    tags: ['mismatch', 'wrong vehicle', 'different car', 'safety', 'danger', 'fraud'],
  },
  {
    id: 'faq-d5',
    category: 'driver',
    question: 'What should I do if I leave an item in the cab?',
    answer:
      'Contact our support desk immediately with your booking reference, travel date, and description of the lost item. We will contact the assigned chauffeur to retrieve and return your belongings.',
    tags: ['lost', 'lost item', 'left in cab', 'forgot', 'belongings', 'bag'],
  },

  // App Support
  {
    id: 'faq-a1',
    category: 'app',
    question: 'I cannot log in. What should I do?',
    answer:
      'Verify your 10-digit mobile number and mobile network. If you do not receive the SMS OTP, wait 30 seconds before tapping "Resend OTP". If the issue persists, contact App Support at +91 91873 36058.',
    tags: ['login', 'sign in', 'cannot log in', 'account', 'phone number'],
  },
  {
    id: 'faq-a2',
    category: 'app',
    question: 'I am not receiving my OTP.',
    answer:
      'Ensure your SIM has active SMS service and no DND blocking on transactional messages. Restart the app or check if airplane mode is off. You can also tap App Support Helpline for immediate technical resolution.',
    tags: ['otp issue', 'not receiving otp', 'sms', 'code'],
  },
  {
    id: 'faq-a3',
    category: 'app',
    question: 'The app is not showing my current location.',
    answer:
      'Go to your phone\'s Settings > Apps > KANDY CABS > Permissions, and enable "Location" set to "Allow while using the app" with "Precise Location" enabled. Also check that your device GPS is switched on.',
    tags: ['gps', 'location', 'permission', 'map not working', 'accuracy'],
  },
  {
    id: 'faq-a4',
    category: 'app',
    question: 'I am not receiving trip notifications.',
    answer:
      'Ensure push notifications are allowed in your device Settings for KANDY CABS. Important booking confirmations and driver details will also always be available inside the "My Bookings" tab.',
    tags: ['notification', 'alerts', 'push', 'updates'],
  },
  {
    id: 'faq-a5',
    category: 'app',
    question: 'The app is crashing or not working properly.',
    answer:
      'Close and restart the app, or clear app cache in Android Settings. Ensure you are running the latest app version. You can submit an App Support ticket below or call our technical helpline at +91 91873 36058.',
    tags: ['crash', 'bug', 'glitch', 'not working', 'error', 'freeze'],
  },
];

export interface SafetyTip {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const SAFETY_TIPS: SafetyTip[] = [
  {
    id: 's1',
    title: 'Match Vehicle & Chauffeur',
    description: 'Always cross-check vehicle license plate and chauffeur photo with your confirmed booking card before boarding.',
    icon: 'shield-checkmark-outline',
  },
  {
    id: 's2',
    title: 'Share OTP Only At Boarding',
    description: 'Never share your 4-digit ride OTP over the phone. Share it only once you are safely seated in the correct vehicle.',
    icon: 'key-outline',
  },
  {
    id: 's4',
    title: 'Emergency Assistance 112',
    description: 'If you ever feel unsafe or encounter an emergency during your trip, tap Emergency SOS or dial Police Emergency (112).',
    icon: 'alert-circle-outline',
  },
];
