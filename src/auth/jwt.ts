import { randomBytes } from "node:crypto";
import { sign, verify } from "hono/jwt";

// decisions.md TBD-4: 署名鍵は環境変数 JWT_SECRET から読む。
// 未設定時は起動ごとにランダムな鍵を生成する(再起動で既存トークンは無効化される開発・テスト用フォールバック)。
const defaultSecret = process.env.JWT_SECRET ?? randomBytes(32).toString("hex");

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 日

/** HS256・有効期限 7 日の JWT を発行する。sub にユーザー ID を入れる。 */
export function issueToken(
  userId: number,
  secret: string = defaultSecret,
  ttlSeconds: number = TOKEN_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: String(userId), iat: now, exp: now + ttlSeconds }, secret, "HS256");
}

/** 署名と有効期限を検証し、正当ならユーザー ID を返す。不正・期限切れは null。 */
export async function verifyToken(
  token: string,
  secret: string = defaultSecret,
): Promise<number | null> {
  try {
    const payload = await verify(token, secret, "HS256");
    const userId = Number(payload.sub);
    return Number.isInteger(userId) ? userId : null;
  } catch {
    return null;
  }
}
