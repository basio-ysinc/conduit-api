import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Db } from "./db/index.js";
import { type UserRow, findUserById } from "./services/users.js";

// 鍵は JWT_SECRET から読む。未設定ならプロセス起動ごとにランダム生成(開発・テスト用)。
const secret = process.env.JWT_SECRET ?? randomBytes(32).toString("hex");
const TOKEN_TTL_SEC = 7 * 24 * 60 * 60;

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

/** HS256 JWT を発行する。payload は {sub, iat, exp}。 */
export function signToken(userId: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ sub: userId, iat: now, exp: now + TOKEN_TTL_SEC }));
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/** 署名と exp を検証し、正当なら {sub} を返す。 */
export function verifyToken(token: string): { sub: number } | null {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.sub !== "number" || typeof data.exp !== "number") return null;
    if (data.exp <= Math.floor(Date.now() / 1000)) return null;
    return { sub: data.sub };
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}.${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(".");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export type AuthResult = { user: UserRow } | { error: "missing" | "invalid" };

/** Authorization: Token <jwt> を検証してユーザーを解決する。 */
export function authenticate(db: Db, header: string | undefined): AuthResult {
  const token = header?.match(/^Token (.+)$/)?.[1];
  if (!token) return { error: "missing" };
  const payload = verifyToken(token);
  const user = payload ? findUserById(db, payload.sub) : null;
  return user ? { user } : { error: "invalid" };
}

/** 401 応答のメッセージに変換する。 */
export function authErrorMessage(error: "missing" | "invalid"): string {
  return error === "missing" ? "is missing" : "is invalid";
}
