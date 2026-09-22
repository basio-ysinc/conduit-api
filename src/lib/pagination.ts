export type Pagination = { limit: number; offset: number };

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * 一覧系エンドポイント(GET /articles, GET /articles/feed 等)共通のページネーション。
 * limit: 既定 20、上限 100(超過分は上限に丸める)。offset: 既定 0。
 * 数値でない値・負数・limit=0 は 422。
 */
export function parsePagination(query: {
  limit?: string;
  offset?: string;
}): { ok: true; value: Pagination } | { ok: false; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  let limit = DEFAULT_LIMIT;
  if (query.limit !== undefined) {
    if (!/^\d+$/.test(query.limit) || Number(query.limit) < 1) {
      errors.limit = ["must be a positive integer"];
    } else {
      limit = Math.min(Number(query.limit), MAX_LIMIT);
    }
  }

  let offset = 0;
  if (query.offset !== undefined) {
    if (!/^\d+$/.test(query.offset)) {
      errors.offset = ["must be a non-negative integer"];
    } else {
      offset = Number(query.offset);
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { limit, offset } };
}
