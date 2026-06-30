// Turn a contact's phone number into a wa.me-ready international number.
//
// WhatsApp deep links need the country code. Contacts saved with "+<code>…"
// already have it; bare local numbers (e.g. an Indian "98765 43210") don't — so
// we infer the country code from the user's own locale. This stays GLOBAL: an
// Indian user gets +91, a US user +1, a UK user +44, without anything hardcoded
// to one country.

// Region (ISO 3166-1 alpha-2) → country calling code. Covers the most common
// markets; unknown regions just fall back to the digits as-is (WhatsApp will ask).
const REGION_CALLING_CODE: Record<string, string> = {
  IN: "91", US: "1", CA: "1", GB: "44", AE: "971", SG: "65", AU: "61", NZ: "64",
  DE: "49", FR: "33", ES: "34", IT: "39", NL: "31", IE: "353", PT: "351",
  SE: "46", NO: "47", DK: "45", FI: "358", CH: "41", AT: "43", BE: "32", PL: "48",
  BR: "55", MX: "52", AR: "54", CL: "56", CO: "57", ZA: "27", NG: "234", KE: "254",
  EG: "20", SA: "966", QA: "974", KW: "965", BH: "973", OM: "968", PK: "92",
  BD: "880", LK: "94", NP: "977", ID: "62", MY: "60", PH: "63", TH: "66", VN: "84",
  JP: "81", KR: "82", CN: "86", HK: "852", TW: "886", TR: "90", IL: "972",
};

function localeCallingCode(): string {
  try {
    const langs =
      typeof navigator !== "undefined"
        ? [navigator.language, ...(navigator.languages ?? [])]
        : [];
    for (const l of langs) {
      const region = l?.split("-")[1]?.toUpperCase();
      if (region && REGION_CALLING_CODE[region]) return REGION_CALLING_CODE[region];
    }
  } catch {
    /* navigator unavailable */
  }
  return "";
}

// Normalize a contact phone string into digits with a country code, for wa.me.
export function toWhatsAppNumber(tel: string): string {
  const hadPlus = tel.trim().startsWith("+");
  let digits = tel.replace(/\D/g, "");
  if (hadPlus) return digits; // already international (e.g. +91 98765 43210)
  digits = digits.replace(/^0+/, ""); // drop a local trunk prefix (0XXXXXXXXXX)
  const cc = localeCallingCode();
  // Only prepend when it looks like a bare local number and doesn't already
  // start with our country code — never mangle an already-international number.
  if (cc && digits.length <= 11 && !digits.startsWith(cc)) return cc + digits;
  return digits;
}
