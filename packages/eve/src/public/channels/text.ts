// Text helpers the built-in channels share for platform limits.

import type { InteractionOption } from "#protocol/session-events/families/interaction.js";

/** Caps `value` at `maxLength` characters, ending a cut value with `...`. */
export function truncate(value: string, maxLength: number): string {
  if (maxLength <= 0) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

/** `values` in consecutive groups of `size`. */
export function chunk<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export function optionDetails(
  options: readonly Pick<InteractionOption, "description" | "label">[],
  labelMaxLength: number,
): string | undefined {
  if (options.every((option) => !option.description && option.label.length <= labelMaxLength)) {
    return undefined;
  }
  return options
    .map(({ description, label }) => (description ? `• ${label}: ${description}` : `• ${label}`))
    .join("\n");
}
