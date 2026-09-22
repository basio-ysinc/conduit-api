import type { Context } from "hono";
import type { z } from "zod";

type ErrorStatus = 401 | 403 | 404 | 409 | 422;

/** エラーレスポンス {"errors": {"<field>": ["<message>"]}} を返す。 */
export function fail(c: Context, status: ErrorStatus, field: string, message: string) {
  return c.json({ errors: { [field]: [message] } }, status);
}

/** zod の検証失敗を 422 エラー形式に変換する。フィールド名は issue パスの末尾を使う。 */
export function failValidation(c: Context, error: z.ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[issue.path.length - 1] ?? "body");
    errors[field] ??= ["can't be blank"];
  }
  return c.json({ errors }, 422);
}

/** リクエスト body を JSON として読む。壊れていれば null。 */
export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}
