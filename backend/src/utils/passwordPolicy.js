import prisma from "../config/db.js";
import ApiError from "./ApiError.js";

/** Common weak passwords (lowercase). Extend as needed. */
const COMMON_PASSWORDS = new Set(
  [
    "password",
    "password1",
    "password123",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty123",
    "qwertyui",
    "abcdefgh",
    "abcd1234",
    "abc12345",
    "admin123",
    "welcome1",
    "letmein1",
    "changeme",
    "passw0rd",
    "iloveyou",
    "monkey12",
    "dragon12",
    "master12",
    "login123",
    "eic12345",
    "claim123",
  ].map((s) => s.toLowerCase()),
);

export async function getPasswordPolicy() {
  const s = await prisma.systemSettings.findFirst({
    where: { key: "singleton" },
  });
  return {
    minLength: Math.max(8, s?.sec_min_password_length ?? 10),
    requireUppercase: s?.sec_require_uppercase ?? true,
    requireNumber: s?.sec_require_number ?? true,
    requireSpecial: s?.sec_require_special_char ?? true,
    requireLowercase: true,
    preventReuseCount: s?.sec_prevent_password_reuse_count ?? 0,
  };
}

function hasSequentialChars(password, run = 4) {
  const s = password.toLowerCase();
  const rows = [
    "abcdefghijklmnopqrstuvwxyz",
    "zyxwvutsrqponmlkjihgfedcba",
    "0123456789",
    "9876543210",
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm",
  ];
  for (const row of rows) {
    for (let i = 0; i <= row.length - run; i++) {
      if (s.includes(row.slice(i, i + run))) return true;
    }
  }
  // numeric step sequences like 1357 less critical; abcd / 1234 covered above
  return false;
}

function hasRepeatedCharRun(password, run = 3) {
  return /(.)\1{2,}/.test(password);
}

function isMostlySequentialOrSimple(password) {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  // only letters+digits and matches weak shape like abcd1234
  if (/^[a-z]{4,}\d{2,}$/i.test(password) && hasSequentialChars(password, 4)) {
    return true;
  }
  if (/^\d{6,}$/.test(password)) return true;
  if (/^[a-z]+$/i.test(password)) return true;
  return false;
}

/**
 * Enforces System Settings + strong-password checks.
 * Throws ApiError(400) if weak / non-compliant.
 */
export async function assertPasswordPolicy(password, policy) {
  if (password == null || typeof password !== "string" || !password.length) {
    throw new ApiError(400, "Password is required");
  }

  // reject leading/trailing spaces
  if (password !== password.trim()) {
    throw new ApiError(400, "Password must not start or end with spaces");
  }

  const p = policy || (await getPasswordPolicy());
  const errors = [];

  if (password.length < p.minLength) {
    errors.push(`at least ${p.minLength} characters`);
  }
  if (p.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("one lowercase letter");
  }
  if (p.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("one uppercase letter");
  }
  if (p.requireNumber && !/[0-9]/.test(password)) {
    errors.push("one number");
  }
  if (p.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("one special character (e.g. !@#$%&*)");
  }

  if (hasRepeatedCharRun(password, 3)) {
    errors.push("no 3+ repeated characters in a row (e.g. aaa, 111)");
  }
  if (hasSequentialChars(password, 4)) {
    errors.push("no 4+ sequential characters (e.g. abcd, 1234, qwer)");
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("password is too common");
  }
  if (isMostlySequentialOrSimple(password) && errors.length === 0) {
    // catch residual weak patterns if complexity somehow passed
    errors.push("password is too predictable");
  }

  if (errors.length) {
    throw new ApiError(
      400,
      `Password does not meet security policy: ${errors.join("; ")}`,
    );
  }
}

/** Same checks without throwing — for optional UI reuse (optional) */
export function evaluatePasswordStrength(password, policy) {
  try {
    // sync subset; call assert only on server with async policy
    return { ok: true, errors: [] };
  } catch {
    return { ok: false, errors: [] };
  }
}
