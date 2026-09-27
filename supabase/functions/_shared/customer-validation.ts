// Single source of truth for customer / address validation.
// Pure TypeScript (no Deno / browser APIs) — imported by the booking forms
// in the browser AND by the create-payment edge function, so the server
// re-applies exactly the same rules and a crafted API call cannot bypass them.

export type FieldError =
  | "firstName" | "lastName" | "email" | "phone"
  | "street" | "houseNumber" | "postalCode" | "city" | "cityPostalMismatch";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
// Letters from any script, plus space, apostrophe, hyphen, dot.
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' .\-]{0,59}$/u;
const STREET_RE = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9' .,\-/]{1,99}$/u;
const HOUSE_NO_RE = /^\d{1,5}\s?[a-zA-Z]?(\s?[-/]\s?\d{1,5}\s?[a-zA-Z]?)?$/;
const CITY_RE = /^[\p{L}\p{M}][\p{L}\p{M}' .\-()]{1,59}$/u;

const FAKE_WORDS = new Set([
  "test", "testing", "tester", "asdf", "asd", "qwer", "qwert", "qwertz", "qwerty", "xxx",
  "abc", "aaa", "foo", "bar", "fake", "none", "null", "undefined", "n/a", "na", "dummy", "sample",
  "example", "keine", "unbekannt", "irgendwo", "blabla", "lorem", "ipsum", "test address", "teststraße",
  "teststrasse", "musterstraße", "musterstrasse",
]);

const norm = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** True for obviously fake/random values: keyboard mash, repeated chars, "test". */
export function looksFake(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  if (FAKE_WORDS.has(v)) return true;
  const words = v.split(/[\s\-.]+/).filter(Boolean);
  if (words.length > 0 && words.every((w) => FAKE_WORDS.has(w))) return true;
  const letters = v.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 3 && /^(.)\1+$/u.test(letters)) return true; // "aaaa"
  if (/(asdf|qwer|yxcv|zxcv|hjkl|jkl;)/.test(v)) return true;
  // Long letter run without any vowel (Latin script only) → random mash.
  if (/^[a-zß]+$/.test(letters) && letters.length >= 5 && !/[aeiouyäöü]/.test(letters)) return true;
  return false;
}

export function isValidEmail(v: unknown): boolean {
  const s = norm(v);
  return s.length >= 5 && s.length <= 254 && EMAIL_RE.test(s) && !/\.\./.test(s);
}

export function isValidName(v: unknown): boolean {
  const s = norm(v);
  return s.length >= 2 && NAME_RE.test(s) && !looksFake(s);
}

/** International-friendly: 7–15 digits (E.164), optional +, spaces, (), -, /. */
export function isValidPhone(v: unknown, countryCode?: string | null): boolean {
  const s = norm(v);
  if (!/^\+?[\d\s()\-/.]{6,25}$/.test(s)) return false;
  const digits = s.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  if (/^(\d)\1+$/.test(digits)) return false; // 0000000
  const cc = (countryCode || "").toUpperCase();
  if (cc === "DE" && !s.startsWith("+") && !s.startsWith("00")) {
    // German national format must start with 0 and have 10–12 digits in total.
    return digits.startsWith("0") && digits.length >= 10 && digits.length <= 12;
  }
  return true;
}

const POSTAL_RULES: Record<string, RegExp> = {
  DE: /^\d{5}$/, AT: /^\d{4}$/, CH: /^\d{4}$/, NL: /^\d{4}\s?[A-Z]{2}$/i, BE: /^\d{4}$/,
  FR: /^\d{5}$/, IT: /^\d{5}$/, ES: /^\d{5}$/, PL: /^\d{2}-\d{3}$/, DK: /^\d{4}$/,
  EG: /^\d{5}$/, AE: /^\d{0,6}$/, SA: /^\d{5}(-\d{4})?$/, GB: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
  US: /^\d{5}(-\d{4})?$/,
};

export function isValidPostalCode(v: unknown, countryCode?: string | null): boolean {
  const s = norm(v);
  const rule = POSTAL_RULES[(countryCode || "DE").toUpperCase()];
  if (rule) return rule.test(s) && !(countryCode?.toUpperCase() === "DE" && s === "00000");
  return /^[A-Z0-9][A-Z0-9 \-]{1,9}$/i.test(s);
}

export function isValidStreet(v: unknown): boolean {
  const s = norm(v);
  if (s.length < 3 || !STREET_RE.test(s)) return false;
  if (!/\p{L}{2,}/u.test(s)) return false; // must contain a real word, not just "123"
  return !looksFake(s);
}

export function isValidHouseNumber(v: unknown): boolean {
  return HOUSE_NO_RE.test(norm(v));
}

export function isValidCity(v: unknown): boolean {
  const s = norm(v);
  return CITY_RE.test(s) && !looksFake(s);
}

// Known German postcode prefixes for the cities Massavo serves. Only used when
// the city is recognised — unknown cities are never rejected by this check.
const CITY_POSTAL_PREFIXES: Record<string, string[]> = {
  "köln": ["50", "51"], "koeln": ["50", "51"], "cologne": ["50", "51"],
  "leverkusen": ["51"], "düsseldorf": ["40"], "duesseldorf": ["40"], "dusseldorf": ["40"],
  "bergisch gladbach": ["51"],
};

export function cityMatchesPostalCode(city: unknown, postal: unknown, countryCode?: string | null): boolean {
  if ((countryCode || "DE").toUpperCase() !== "DE") return true;
  const prefixes = CITY_POSTAL_PREFIXES[norm(city).toLowerCase()];
  if (!prefixes) return true;
  return prefixes.some((p) => norm(postal).startsWith(p));
}

export interface CustomerInput {
  firstName?: string; lastName?: string; email?: string; phone?: string;
  street?: string; houseNumber?: string; postalCode?: string; city?: string;
}

/** Returns the list of failing fields (empty = valid). */
export function validateCustomer(input: CustomerInput, countryCode?: string | null, requireAddress = true): FieldError[] {
  const errors: FieldError[] = [];
  if (!isValidName(input.firstName)) errors.push("firstName");
  if (!isValidName(input.lastName)) errors.push("lastName");
  if (!isValidEmail(input.email)) errors.push("email");
  if (!isValidPhone(input.phone, countryCode)) errors.push("phone");
  if (requireAddress) {
    if (!isValidStreet(input.street)) errors.push("street");
    if (!isValidHouseNumber(input.houseNumber)) errors.push("houseNumber");
    if (!isValidPostalCode(input.postalCode, countryCode)) errors.push("postalCode");
    if (!isValidCity(input.city)) errors.push("city");
    if (!errors.includes("postalCode") && !errors.includes("city") &&
        !cityMatchesPostalCode(input.city, input.postalCode, countryCode)) {
      errors.push("cityPostalMismatch");
    }
  }
  return errors;
}

/** Gym/Hotel guests may live abroad: a 5-digit code is treated as German, anything else as international. */
export function inferAddressCountry(postal: unknown, fallback = "DE"): string {
  const s = norm(postal);
  if (/^\d{5}$/.test(s)) return fallback;
  return /^\d+$/.test(s) && s.length < 5 ? fallback : "XX";
}
