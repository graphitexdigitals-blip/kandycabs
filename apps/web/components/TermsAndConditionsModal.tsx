'use client';

import React, { useState } from 'react';

interface TermSection {
  id: number;
  title: string;
  body?: string;
  bullets?: string[];
}

const TERMS_SECTIONS: TermSection[] = [
  {
    id: 1,
    title: 'Acceptance of Terms',
    body: 'By registering or accessing the KANDY CABS application, you agree to comply with these Terms & Conditions, the applicable Booking Policy, Cancellation Policy, Privacy Policy, and Ride Safety Guidelines. If you do not agree, you must not proceed.',
  },
  {
    id: 2,
    title: 'Eligibility and Account Registration',
    bullets: [
      'Customers must provide accurate and complete registration details.',
      'You are responsible for maintaining the confidentiality of your login credentials and OTPs.',
      'Do not create fake accounts, impersonate another person, or misuse the application.',
      'KANDY CABS may restrict or suspend accounts for suspected fraud, misuse, or unlawful activity, subject to applicable law.',
    ],
  },
  {
    id: 3,
    title: 'Booking and Confirmation',
    bullets: [
      'A booking request is subject to vehicle availability and confirmation by KANDY CABS.',
      'Customers must provide correct pickup and drop-off addresses, travel dates, reporting times, contact numbers, passenger count, and luggage details.',
      'Changes to the itinerary, pickup time, destination, or vehicle category must be communicated in advance and may result in revised charges.',
      'Customers should rely on the final booking confirmation for the agreed trip details and price.',
    ],
  },
  {
    id: 4,
    title: 'Fares, Taxes and Additional Charges',
    bullets: [
      'The applicable fare and inclusions will be communicated before booking confirmation.',
      'Toll charges, parking fees, permits, state taxes, additional kilometres, waiting time, night allowances, or other trip-related charges may apply where disclosed in the quotation or applicable booking conditions.',
      'GST and other applicable taxes will be charged as required by law.',
      'Any additional charges must be explained and supported by the applicable booking terms or actual trip expenses, as relevant.',
    ],
  },
  {
    id: 5,
    title: 'Payments and Invoices',
    bullets: [
      'Customers must pay through the payment methods officially authorised by KANDY CABS.',
      'For safety and transparency, customers are requested not to make cash payments directly to the chauffeur. Payments should be made through authorised online channels against the applicable invoice or payment request.',
      'Customers should retain their payment confirmation and contact KANDY CABS if a payment discrepancy arises.',
      'Invoices and receipts will be issued according to the applicable billing process.',
    ],
  },
  {
    id: 6,
    title: 'Cancellation, Rescheduling and Refunds',
    bullets: [
      'Cancellation and rescheduling charges, if any, will be governed by the cancellation policy communicated for the booking.',
      'Refund eligibility and processing timelines depend on the applicable policy, payment provider, and circumstances of cancellation.',
      'If KANDY CABS must cancel or materially change a confirmed booking, the customer will be informed and offered an appropriate resolution under the applicable policy and law.',
    ],
  },
  {
    id: 7,
    title: 'Customer Responsibilities',
    bullets: [
      'Be present at the confirmed pickup location at the scheduled time.',
      'Ensure all passengers wear seat belts and comply with applicable safety laws.',
      'Treat chauffeurs respectfully and refrain from abusive, threatening, discriminatory, or unlawful behaviour.',
      'Do not request speeding, dangerous driving, illegal stops, or violations of traffic regulations.',
      'Do not carry prohibited, illegal, dangerous, or hazardous items in the vehicle.',
      'Keep personal belongings secure and check the vehicle before leaving.',
    ],
  },
  {
    id: 8,
    title: 'Passenger Safety and Emergency Situations',
    bullets: [
      'Customers should verify the vehicle and chauffeur details provided in the app or booking confirmation before boarding.',
      'Any safety concern, accident, harassment, suspected misconduct, or emergency should be reported promptly to the appropriate emergency services and KANDY CABS.',
      'Chauffeurs may refuse requests that would violate traffic laws or compromise passenger safety.',
      'Children must be accompanied and supervised by a responsible adult, with suitable child restraints used where required.',
    ],
  },
  {
    id: 9,
    title: 'Trip Duration and Route',
    bullets: [
      'Estimated arrival times are indicative and may vary due to traffic, weather, road closures, vehicle restrictions, or other circumstances beyond reasonable control.',
      'Extra kilometres, additional stops, route deviations requested by the customer, and extensions beyond the agreed package may incur additional charges according to the confirmed fare terms.',
      'Drivers must follow applicable laws and prioritise road safety.',
    ],
  },
  {
    id: 10,
    title: 'Luggage and Personal Belongings',
    bullets: [
      'Customers must disclose luggage quantities and oversized items in advance.',
      'Luggage must fit safely within the available vehicle capacity.',
      'KANDY CABS should be notified promptly if any item is lost or left behind. Recovery and delivery arrangements may be subject to availability and reasonable disclosed costs.',
    ],
  },
  {
    id: 11,
    title: 'Privacy and Personal Information',
    bullets: [
      'Customer information may be used for account creation, booking management, payment processing, trip coordination, customer support, safety, and legal compliance.',
      'Location information may be processed where necessary for pickup coordination, navigation, trip tracking, and safety, subject to the app\'s permissions and Privacy Policy.',
      'Personal information will be handled in accordance with applicable data protection laws and the KANDY CABS Privacy Policy.',
      'Promotional communications should be handled in accordance with applicable consent and communication preferences.',
    ],
  },
  {
    id: 12,
    title: 'Service Availability and Limitations',
    bullets: [
      'Vehicle and chauffeur availability may vary by location, date, time, and service category.',
      'KANDY CABS will make reasonable efforts to provide the confirmed service but cannot guarantee that the application will always be uninterrupted or error-free.',
      'Nothing in these terms excludes liability or consumer rights that cannot legally be excluded under applicable law.',
    ],
  },
  {
    id: 13,
    title: 'Complaints and Customer Support',
    body: 'Customers may report booking issues, billing discrepancies, service complaints, or safety concerns through the support details displayed in the application or on the official website: www.kandycabs.in. Complaints will be handled in accordance with applicable law and the company\'s grievance procedure.',
  },
  {
    id: 14,
    title: 'Updates to These Terms',
    body: 'KANDY CABS may update these terms when required for operational, legal, or service-related reasons. Material changes will be communicated as appropriate. Where fresh acceptance is legally required or necessary for continued use, customers will be asked to review and accept the updated terms.',
  },
  {
    id: 15,
    title: 'Governing Law',
    body: 'These terms are governed by the applicable laws of India. Disputes will be handled by the competent authorities or courts having jurisdiction under applicable law, without limiting any statutory consumer rights.',
  },
];

interface TermsAndConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
}

export function TermsAndConditionsModal({
  isOpen,
  onClose,
  onAgree,
}: TermsAndConditionsModalProps) {
  const [agreed, setAgreed] = useState(false);

  if (!isOpen) return null;

  const handleAgreeAndContinue = () => {
    onAgree();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl relative border border-slate-100 overflow-hidden">
        {/* Header (Matching Image 3) */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition font-bold"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">Terms &amp; Conditions</h3>
              <p className="text-xs text-slate-500">Kandy Cabs Customer Policy</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-[#162232]">
            <svg className="w-3.5 h-3.5 text-[#162232] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>English</span>
            <svg className="w-3 h-3 text-[#162232] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-4 text-xs flex-1">
          {/* Hero Banner Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-md bg-orange-100/70 text-[#f0750f] border border-orange-200">
                CUSTOMER TERMS &amp; CONDITIONS
              </span>
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Official
              </span>
            </div>

            <h4 className="text-sm sm:text-base font-bold text-slate-900">
              Please read carefully before proceeding to login.
            </h4>
            <p className="text-[11px] text-slate-500">
              Last updated: October 2026 • Effective for all bookings and accounts
            </p>
          </div>

          {/* Policy Sections */}
          <div className="space-y-3">
            {TERMS_SECTIONS.map((section) => (
              <div
                key={section.id}
                className="p-4 rounded-2xl border border-slate-100 bg-white shadow-2xs space-y-2"
              >
                <div className="flex items-center gap-2.5 sm:gap-2">
                  <span className="w-8 h-8 rounded-xl sm:w-6.5 sm:h-6.5 sm:rounded-lg bg-[#e0e7ff] text-[#162232] font-black flex items-center justify-center text-xs sm:text-[11px] flex-shrink-0 shadow-2xs">
                    {String(section.id).padStart(2, '0')}
                  </span>
                  <h5 className="font-bold text-sm text-slate-900">{section.title}</h5>
                </div>

                {section.body && (
                  <p className="text-slate-600 leading-relaxed text-xs pl-10.5 sm:pl-8.5">
                    {section.body}
                  </p>
                )}

                {section.bullets && (
                  <ul className="space-y-1.5 pl-10.5 sm:pl-8.5 text-slate-600 text-xs">
                    {section.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#f0750f] font-bold mt-0.5">•</span>
                        <span className="leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer with Checkbox & Agree Button (Matching Image 3) */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex-shrink-0 space-y-3">
          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 accent-[#f0750f] rounded cursor-pointer"
            />
            <span>
              I agree to the <span className="text-[#f0750f] font-bold">Terms &amp; Conditions</span> and{' '}
              <span className="text-[#f0750f] font-bold">Cancellation Policy</span>.
            </span>
          </label>

          <button
            type="button"
            disabled={!agreed}
            onClick={handleAgreeAndContinue}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 tracking-wide shadow-sm ${
              agreed
                ? 'bg-[#16a34a] hover:bg-[#15803d] text-white active:scale-[0.99]'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70'
            }`}
          >
            <span>Agree to Terms &amp; Continue</span>
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
