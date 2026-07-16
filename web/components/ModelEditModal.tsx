"use client";

import { useEffect, useState } from "react";
import { ModelEmojiPicker } from "@/components/ModelEmojiPicker";
import { DEFAULT_MODEL_EMOJI } from "@/lib/modelEmojis";
import {
  formatModelDisplayName,
  getStoredEmail,
  parseModelDisplayName,
  updateModel,
} from "@/lib/api";

type Props = {
  open: boolean;
  modelId: number;
  name: string;
  onClose: () => void;
  onSaved: (name: string) => void;
};

export function ModelEditModal({ open, modelId, name, onClose, onSaved }: Props) {
  const [emoji, setEmoji] = useState<string>(DEFAULT_MODEL_EMOJI);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const parsed = parseModelDisplayName(name);
    setEmoji(parsed.emoji || DEFAULT_MODEL_EMOJI);
    setLabel(parsed.name);
    setError("");
  }, [open, name]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function save() {
    const email = getStoredEmail();
    if (!email) return;
    const nextName = formatModelDisplayName(emoji, label);
    if (!label.trim()) {
      setError("Nom requis.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const model = await updateModel(email, modelId, nextName);
      onSaved(model.name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  const preview = formatModelDisplayName(emoji, label || "Modèle");

  return (
    <div className="model-edit-overlay" onClick={onClose} role="presentation">
      <div
        className="model-edit-modal card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-edit-title"
      >
        <div className="model-edit-modal-head">
          <h2 id="model-edit-title" style={{ margin: 0 }}>Modifier le modèle</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="model-edit-preview">
          <span className="model-edit-preview-emoji">{emoji}</span>
          <div>
            <p className="model-edit-preview-label">Aperçu</p>
            <p className="model-edit-preview-name">{preview}</p>
          </div>
        </div>

        <label className="model-edit-field">
          <span className="model-edit-field-label">Nom</span>
          <input
            type="text"
            className="model-edit-name-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex : Léa, Anais…"
            maxLength={72}
            autoFocus
          />
        </label>

        <div className="model-edit-field">
          <span className="model-edit-field-label">Émoji</span>
          <ModelEmojiPicker value={emoji} onChange={setEmoji} />
        </div>

        {error && <p className="status err" style={{ margin: "12px 0 0" }}>{error}</p>}

        <div className="model-edit-modal-actions">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button type="button" className="btn btn-ghost" disabled={saving} onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
