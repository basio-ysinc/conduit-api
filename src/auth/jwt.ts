import { randomBytes } from "node:crypto";
import { sign, verify } from "hono/jwt";

// decisions.md TBD-4: 署名鍵は環境変数 JWT_SECRET から読む。
// 未設定かつ NODE_ENV=production なら明示的に落とす(設定漏れに気づけない暗黙フォールバックを防ぐ)。
// それ以外(開発・テスト)ではプロセス内で固定のランダム鍵にフォールバックする
// (再起動で既存トークンは無効化される)。
let fallbackSecret: string | undefined;

/** 署名鍵を呼び出し時に解決する(モジュール初期化時に固定されず、後からの環境変数差し替えが効く)。 */
export function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set when NODE_ENV=production");
  }
  fallbackSecret ??= randomBytes(32).toString("hex");
  return fallbackSecret;
}

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 日

/** HS256・有効期限 7 日の JWT を発行する。sub にユーザー ID を入れる。 */
export function issueToken(
  userId: number,
  secret: string = resolveJwtSecret(),
  ttlSeconds: number = TOKEN_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: String(userId), iat: now, exp: now + ttlSeconds }, secret, "HS256");
}

/** 署名と有効期限を検証し、正当ならユーザー ID を返す。不正・期限切れは null。 */
export async function verifyToken(
  token: string,
  secret: string = resolveJwtSecret(),
): Promise<number | null> {
  try {
    const payload = await verify(token, secret, "HS256");
    const userId = Number(payload.sub);
    return Number.isInteger(userId) ? userId : null;
  } catch {
    return null;
  }
}
