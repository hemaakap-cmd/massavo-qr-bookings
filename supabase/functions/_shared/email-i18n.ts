/**
 * MASSAVO Email Internationalization (i18n) System
 * Determines email language from gym → country → default_language
 * Supports: de (German), en (English), ar (Arabic)
 */

export type EmailLang = "de" | "en" | "ar";

export function isRTL(lang: EmailLang): boolean {
  return lang === "ar";
}

/** Get date formatted per locale */
export function formatDateLocalized(dateStr: string, lang: EmailLang): string {
  const [y, m, d] = dateStr.split("-");
  if (lang === "de") return `${d}.${m}.${y}`;
  if (lang === "ar") return `${y}/${m}/${d}`;
  return `${m}/${d}/${y}`;
}

/** Get time formatted per locale */
export function formatTimeLocalized(timeStr: string, lang: EmailLang): string {
  const short = timeStr.slice(0, 5);
  if (lang === "de") return `${short} Uhr`;
  return short;
}

/** Currency formatting */
export function formatCurrency(amount: number, lang: EmailLang, symbol = "€"): string {
  const formatted = amount.toFixed(2);
  if (lang === "ar" && symbol === "€") return `${formatted} يورو`;
  return `${symbol}${formatted}`;
}

// ═══════════════════════════════════════════════════
// Translation dictionaries
// ═══════════════════════════════════════════════════

const translations: Record<string, Record<EmailLang, string>> = {
  // Greetings & Signatures
  greeting_prefix: {
    de: "Guten Tag",
    en: "Dear",
    ar: "مرحباً",
  },
  default_customer: {
    de: "geschätzte/r Kunde/in",
    en: "Valued Customer",
    ar: "عميلنا الكريم",
  },
  signature_regards: {
    de: "Mit freundlichen Grüßen,",
    en: "Kind regards,",
    ar: "مع أطيب التحيات،",
  },
  signature_team: {
    de: "Ihr Massavo Team",
    en: "Your Massavo Team",
    ar: "فريق Massavo",
  },
  auto_generated: {
    de: "Diese E-Mail wurde automatisch generiert.",
    en: "This email was generated automatically.",
    ar: "تم إنشاء هذه الرسالة تلقائياً.",
  },

  // Booking Confirmation
  booking_confirmed_heading: {
    de: "Buchungsbestätigung",
    en: "Booking Confirmation",
    ar: "تأكيد الحجز",
  },
  booking_confirmed_thanks: {
    de: "Vielen Dank für Ihre Buchung. Ihr Termin wurde erfolgreich bestätigt.",
    en: "Thank you for your booking. Your appointment has been successfully confirmed.",
    ar: "شكراً لحجزك. تم تأكيد موعدك بنجاح.",
  },
  appointment_details: {
    de: "Termindetails",
    en: "Appointment Details",
    ar: "تفاصيل الموعد",
  },
  label_location: {
    de: "Standort",
    en: "Location",
    ar: "الموقع",
  },
  label_service: {
    de: "Service",
    en: "Service",
    ar: "الخدمة",
  },
  label_date: {
    de: "Datum",
    en: "Date",
    ar: "التاريخ",
  },
  label_time: {
    de: "Uhrzeit",
    en: "Time",
    ar: "الوقت",
  },
  label_amount: {
    de: "Betrag",
    en: "Amount",
    ar: "المبلغ",
  },
  arrive_early: {
    de: "Bitte erscheinen Sie 10 Minuten vor Ihrem geplanten Termin.",
    en: "Please arrive 10 minutes before your scheduled appointment.",
    ar: "يرجى الحضور قبل 10 دقائق من موعدك المحدد.",
  },
  policy_heading: {
    de: "Wichtige Buchungsrichtlinien",
    en: "Important Booking Policies",
    ar: "سياسات الحجز المهمة",
  },
  policy_cancellation: {
    de: "<strong>Stornierung / Umbuchung:</strong><br>Änderungen oder Stornierungen müssen mindestens <strong>24 Stunden</strong> vor dem Termin vorgenommen werden. Bei verspäteter Absage kann keine Rückerstattung erfolgen.",
    en: "<strong>Cancellation / Rescheduling:</strong><br>Changes or cancellations must be made at least <strong>24 hours</strong> before the appointment. Late cancellations are non-refundable.",
    ar: "<strong>الإلغاء / إعادة الجدولة:</strong><br>يجب إجراء التعديلات أو الإلغاء قبل <strong>24 ساعة</strong> على الأقل من الموعد. لا يمكن الاسترداد في حالة الإلغاء المتأخر.",
  },
  policy_towel: {
    de: "<strong>Eigenes Handtuch mitbringen:</strong><br>Bitte bringen Sie Ihr eigenes Handtuch zum Termin mit.",
    en: "<strong>Bring your own towel:</strong><br>Please bring your own towel to your appointment.",
    ar: "<strong>إحضار منشفة خاصة:</strong><br>يرجى إحضار منشفتك الخاصة لموعدك.",
  },
  manage_booking_heading: {
    de: "Buchung verwalten",
    en: "Manage Booking",
    ar: "إدارة الحجز",
  },
  manage_booking_desc: {
    de: "Über den folgenden Link können Sie Ihren Termin umbuchen oder stornieren:",
    en: "Use the following link to reschedule or cancel your appointment:",
    ar: "استخدم الرابط التالي لإعادة جدولة أو إلغاء موعدك:",
  },
  manage_booking_btn: {
    de: "Buchung verwalten",
    en: "Manage Booking",
    ar: "إدارة الحجز",
  },
  booking_code: {
    de: "Buchungscode",
    en: "Booking Code",
    ar: "رمز الحجز",
  },
  therapist_privacy: {
    de: "Therapeuten-Kontaktdaten sind nicht öffentlich sichtbar. Buchungen erfolgen ausschließlich über die Plattform.",
    en: "Therapist contact details are not publicly visible. Bookings are made exclusively through the platform.",
    ar: "بيانات الاتصال بالمعالج غير متاحة للعموم. تتم الحجوزات حصرياً عبر المنصة.",
  },
  pregnancy_notice: {
    de: "<strong>Schwangerschaft & Haftung:</strong><br>Die Kundin hat bestätigt, zum Zeitpunkt der Buchung nicht schwanger zu sein. Massavo übernimmt keine Haftung für Behandlungen, die während einer Schwangerschaft durchgeführt werden.",
    en: "<strong>Pregnancy & Liability:</strong><br>The client has confirmed not being pregnant at the time of booking. Massavo accepts no liability for treatments performed during pregnancy.",
    ar: "<strong>الحمل والمسؤولية:</strong><br>أكدت العميلة عدم وجود حمل وقت الحجز. لا تتحمل Massavo مسؤولية العلاجات أثناء الحمل.",
  },
  subject_booking_confirmed: {
    de: "Buchungsbestätigung",
    en: "Booking Confirmation",
    ar: "تأكيد الحجز",
  },
  contact_support: {
    de: 'Bei Fragen kontaktieren Sie uns unter <a href="mailto:info@massavo.com" style="color:#7a4a2a;">info@massavo.com</a>',
    en: 'For questions, contact us at <a href="mailto:info@massavo.com" style="color:#7a4a2a;">info@massavo.com</a>',
    ar: 'للاستفسار تواصل معنا عبر <a href="mailto:info@massavo.com" style="color:#7a4a2a;">info@massavo.com</a>',
  },

  // Cancellation
  cancel_heading: {
    de: "Termin storniert",
    en: "Appointment Cancelled",
    ar: "تم إلغاء الموعد",
  },
  cancel_desc: {
    de: "Ihr Termin wurde erfolgreich storniert.",
    en: "Your appointment has been successfully cancelled.",
    ar: "تم إلغاء موعدك بنجاح.",
  },
  cancelled_appointment: {
    de: "Stornierter Termin",
    en: "Cancelled Appointment",
    ar: "الموعد الملغى",
  },
  refund_notice: {
    de: "Rückerstattung",
    en: "Refund",
    ar: "الاسترداد",
  },
  refund_desc: {
    de: "Der gezahlte Betrag wird auf Ihr Zahlungsmittel zurückerstattet.",
    en: "The paid amount will be refunded to your original payment method.",
    ar: "سيتم استرداد المبلغ المدفوع إلى وسيلة الدفع الأصلية.",
  },
  subject_cancelled: {
    de: "Termin storniert",
    en: "Appointment Cancelled",
    ar: "تم إلغاء الموعد",
  },

  // Reschedule
  reschedule_heading: {
    de: "Termin umgebucht",
    en: "Appointment Rescheduled",
    ar: "تم إعادة جدولة الموعد",
  },
  reschedule_desc: {
    de: "Ihr Termin wurde erfolgreich umgebucht.",
    en: "Your appointment has been successfully rescheduled.",
    ar: "تم إعادة جدولة موعدك بنجاح.",
  },
  old_appointment: {
    de: "Alter Termin",
    en: "Previous Appointment",
    ar: "الموعد السابق",
  },
  new_appointment: {
    de: "Neuer Termin",
    en: "New Appointment",
    ar: "الموعد الجديد",
  },
  label_details: {
    de: "Details",
    en: "Details",
    ar: "التفاصيل",
  },
  subject_rescheduled: {
    de: "Termin umgebucht",
    en: "Appointment Rescheduled",
    ar: "تم إعادة جدولة الموعد",
  },

  // Admin-only (always German, but having translations doesn't hurt)
  admin_new_booking: {
    de: "Neue Buchung eingegangen",
    en: "New Booking Received",
    ar: "حجز جديد",
  },
  admin_customer_info: {
    de: "Kundeninformation",
    en: "Customer Information",
    ar: "معلومات العميل",
  },
  admin_booking_details: {
    de: "Buchungsdetails",
    en: "Booking Details",
    ar: "تفاصيل الحجز",
  },
  admin_cancellation: {
    de: "Stornierung eingegangen",
    en: "Cancellation Received",
    ar: "تم استلام إلغاء",
  },
  label_customer: {
    de: "Kunde",
    en: "Customer",
    ar: "العميل",
  },
  label_revenue: {
    de: "Umsatz",
    en: "Revenue",
    ar: "الإيرادات",
  },
  label_booking_id: {
    de: "Buchungs-ID",
    en: "Booking ID",
    ar: "رقم الحجز",
  },
};

/** Get a translated string */
export function t(key: string, lang: EmailLang): string {
  return translations[key]?.[lang] || translations[key]?.["en"] || key;
}
