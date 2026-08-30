import type { StatementTemplate } from "@/types";

export function matchTemplate(
  sample: string,
  templates: StatementTemplate[],
): StatementTemplate | undefined {
  const text = sample.toLowerCase();
  return templates.find((template) => {
    const tokens = template.match ?? [];
    return tokens.length > 0 && tokens.every((token) => text.includes(token.toLowerCase()));
  });
}
