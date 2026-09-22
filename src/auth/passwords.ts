import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;

/** scrypt でハッシュ化し `scrypt:N:r:p:salt:hash` 形式で返す。 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** 保存済みハッシュと平文を定時間比較で照合する。形式不正なら false。 */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split(":");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const expected = Buffer.from(parts[5], "hex");
    if (expected.length === 0) return false;
    const hash = scryptSync(password, Buffer.from(parts[4], "hex"), expected.length, {
      N: Number(parts[1]),
      r: Number(parts[2]),
      p: Number(parts[3]),
    });
    return timingSafeEqual(hash, expected);
  } catch {
    return false;
  }
}
