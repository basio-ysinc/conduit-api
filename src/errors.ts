import type { ZodError } from "zod";

/**
 * decisions.md TBD-3 のエラー形式 `{"errors": {"<field>": ["<message>", ...]}}` を
 * zod の issues から組み立てる。欠損・null は "can't be blank" に揃える。
 * 型だけが違う invalid_type(数値を送った等)は zod のメッセージをそのまま返す。
 */
export function validationErrors(error: ZodError): { errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[issue.path.length - 1] ?? "body");
    const isBlank =
      issue.code === "invalid_type" &&
      (issue.received === "undefined" || issue.received === "null");
    const message = isBlank ? "can't be blank" : issue.message;
    errors[field] = [...(errors[field] ?? []), message];
  }
  return { errors };
}
