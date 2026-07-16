export const MODEL_EMOJIS = [
  "✨", "🔥", "💎", "🌸", "⭐",
  "💋", "🦋", "👑", "🍑", "🌹",
  "💫", "🎀", "🖤", "🤍", "💜",
  "🌺", "🍒", "☀️", "🌙", "🐆",
] as const;

export const DEFAULT_MODEL_EMOJI = MODEL_EMOJIS[0];

export type ModelEmoji = (typeof MODEL_EMOJIS)[number];

export function isModelEmoji(value: string): value is ModelEmoji {
  return (MODEL_EMOJIS as readonly string[]).includes(value);
}
