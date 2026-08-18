/**
 * Password rules for sign-up and reset. Labels are the meter's copy, so they
 * stay short enough to sit on one mono line.
 */
export const PASSWORD_RULES = [
  { id: "length", label: "8 chars", test: (value: string) => value.length >= 8 },
  { id: "lower", label: "Lowercase", test: (value: string) => /[a-z]/.test(value) },
  { id: "upper", label: "Uppercase", test: (value: string) => /[A-Z]/.test(value) },
  { id: "digit", label: "Digit", test: (value: string) => /\d/.test(value) },
  { id: "symbol", label: "Symbol", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export const isStrongPassword = (value: string) =>
  PASSWORD_RULES.every((rule) => rule.test(value));

/** Announced once per level change, not per keystroke. */
export function strengthLabel(score: number) {
  if (score === PASSWORD_RULES.length) return "Strong";
  if (score >= 3) return "Getting there";
  return "Too weak";
}
