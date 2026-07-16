"use client";

import { MODEL_EMOJIS } from "@/lib/modelEmojis";

type Props = {
  value: string;
  onChange: (emoji: string) => void;
  columns?: number;
};

export function ModelEmojiPicker({ value, onChange, columns = 5 }: Props) {
  return (
    <div
      className="model-emoji-picker"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      role="listbox"
      aria-label="Choisir un émoji"
    >
      {MODEL_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="option"
          aria-selected={value === emoji}
          className={`model-emoji-option${value === emoji ? " active" : ""}`}
          onClick={() => onChange(emoji)}
        >
          <span>{emoji}</span>
        </button>
      ))}
    </div>
  );
}
