export type Pagination = { limit: number; offset: number };

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * 一覧系エンドポイント(GET /articles, GET /articles/feed 等)共通のページネーション。
 * limit: 既定 20、上限 100(超過分は上限に丸める)。offset: 既定 0。
 * 数値でない値・負数・limit=0・安全整数の範囲外は 422。
 */
export function parsePagination(query: {
  limit?: string;
  offset?: string;
}): { ok: true; value: Pagination } | { ok: false; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  let limit = DEFAULT_LIMIT;
  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!/^\d+$/.test(query.limit) || !Number.isSafeInteger(n) || n < 1) {
      errors.limit = ["must be a positive integer"];
    } else {
      limit = Math.min(n, MAX_LIMIT);
    }
  }

  let offset = 0;
  if (query.offset !== undefined) {
    const n = Number(query.offset);
    if (!/^\d+$/.test(query.offset) || !Number.isSafeInteger(n)) {
      errors.offset = ["must be a non-negative integer"];
    } else {
      offset = n;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { limit, offset } };
}
