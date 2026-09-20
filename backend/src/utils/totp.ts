import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * TOTP (RFC 6238) over HMAC-SHA1, implemented on node:crypto alone.
 *
 * Deliberately dependency-free: an authenticator second factor is a
 * security boundary, and a ~40-line well-understood implementation is
 * easier to audit than an extra supply-chain dependency. The algorithm
 * is fixed and standardised, so there is nothing to keep up to date.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DIGITS = 6;
const PERIOD_SECONDS = 30;

/** Number of ±steps accepted, to tolerate clock drift on the phone. */
const DRIFT_WINDOW = 1;

export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 character in TOTP secret");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const buffer = Buffer.alloc(8);
  // JavaScript integers are safe well past any realistic TOTP counter,
  // so the high word is written from the float division rather than
  // requiring BigInt.
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", secret).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotp(secretBase32: string, at = Date.now()): string {
  const counter = Math.floor(at / 1000 / PERIOD_SECONDS);
  return hotp(base32Decode(secretBase32), counter);
}

/** Constant-time verification across the accepted drift window. */
export function verifyTotp(
  secretBase32: string,
  token: string,
  at = Date.now()
): boolean {
  const candidate = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(candidate)) return false;

  const secret = base32Decode(secretBase32);
  const counter = Math.floor(at / 1000 / PERIOD_SECONDS);
  const supplied = Buffer.from(candidate);

  let matched = false;
  for (let drift = -DRIFT_WINDOW; drift <= DRIFT_WINDOW; drift += 1) {
    const expected = Buffer.from(hotp(secret, counter + drift));
    // No early exit: keep the loop's timing independent of where the
    // match occurs.
    if (
      expected.length === supplied.length &&
      timingSafeEqual(expected, supplied)
    ) {
      matched = true;
    }
  }
  return matched;
}

/** otpauth:// URI that Google Authenticator, Authy and 1Password read. */
export function buildOtpAuthUrl(options: {
  secret: string;
  accountName: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(
    `${options.issuer}:${options.accountName}`
  );
  const params = new URLSearchParams({
    secret: options.secret,
    issuer: options.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
