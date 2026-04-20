export interface NormalizedPhone {
  raw: string;
  digits: string;
  last10: string;
  variants: string[];
}

const COUNTRY_CODE_CANDIDATES = ["91", "1", "44", "61", "65", "971", "966"];

export function normalizePhone(input: string): NormalizedPhone {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;

  const variants = new Set<string>();
  if (raw) variants.add(raw);
  if (digits) variants.add(digits);
  if (last10) variants.add(last10);

  if (last10.length === 10) {
    variants.add(`0${last10}`);
    for (const cc of COUNTRY_CODE_CANDIDATES) {
      variants.add(`${cc}${last10}`);
      variants.add(`+${cc}${last10}`);
      variants.add(`+${cc} ${last10}`);
    }
  }

  return {
    raw,
    digits,
    last10,
    variants: Array.from(variants),
  };
}
