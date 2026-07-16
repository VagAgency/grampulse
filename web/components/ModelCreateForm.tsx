"use client";

import { useEffect, useRef, useState } from "react";
import { ModelEmojiPicker } from "@/components/ModelEmojiPicker";
import { DEFAULT_MODEL_EMOJI } from "@/lib/modelEmojis";
import { formatModelDisplayName } from "@/lib/api";

type Props = {
  name: string;
  emoji: string;
  onNameChange: (name: string) => void;
  onEmojiChange: (emoji: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
};

export function ModelCreateForm({
  name,
  emoji,
  onNameChange,
  onEmojiChange,
  onSubmit,
  submitting = false,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [pickerOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  const preview = formatModelDisplayName(emoji || DEFAULT_MODEL_EMOJI, name || "Nouveau modèle");

  return (
    <form className="model-create-form" onSubmit={handleSubmit}>
      <div className="model-create-row">
        <div className="model-create-emoji-wrap" ref={wrapRef}>
          <button
            type="button"
            className="model-create-emoji-btn"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            aria-label="Choisir un émoji"
          >
            {emoji || DEFAULT_MODEL_EMOJI}
          </button>
          {pickerOpen && (
            <div className="model-create-emoji-panel card">
              <ModelEmojiPicker
                value={emoji || DEFAULT_MODEL_EMOJI}
                onChange={(next) => {
                  onEmojiChange(next);
                  setPickerOpen(false);
                }}
              />
            </div>
          )}
        </div>
        <input
          type="text"
          className="model-create-name-input"
          placeholder="Nom du modèle (ex : Léa)"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={72}
        />
        <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
          {submitting ? "…" : "+ Modèle"}
        </button>
      </div>
      {name.trim() && (
        <p className="hint model-create-preview">Aperçu : {preview}</p>
      )}
    </form>
  );
}
