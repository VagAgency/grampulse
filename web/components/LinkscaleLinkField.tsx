"use client";

import { useEffect, useState } from "react";

type Props = {
  value?: string | null;
  disabled?: boolean;
  onSave: (url: string | null) => Promise<void>;
};

export function LinkscaleLinkField({ value, disabled, onSave }: Props) {
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  async function save() {
    const next = draft.trim() || null;
    const current = (value || "").trim() || null;
    if (next === current) return;
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="linkscale-field">
      <input
        type="url"
        className="linkscale-input"
        placeholder="https://ton-lien.linkscale.to/…"
        value={draft}
        disabled={disabled || saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
        }}
      />
      {value && (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="linkscale-open"
          title="Ouvrir le lien Linkscale"
        >
          ↗
        </a>
      )}
      {saving && <span className="hint linkscale-saving">…</span>}
    </div>
  );
}
