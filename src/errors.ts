import type { ZodError } from "zod";

/**
 * decisions.md TBD-3 のエラー形式 `{"errors": {"<field>": ["<message>", ...]}}` を
 * zod の issues から組み立てる。型不一致(欠損・null 含む)は "can't be blank" に揃える。
 */
export function validationErrors(error: ZodError): { errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[issue.path.length - 1] ?? "body");
    const message = issue.code === "invalid_type" ? "can't be blank" : issue.message;
    errors[field] = [...(errors[field] ?? []), message];
  }
  return { errors };
}
