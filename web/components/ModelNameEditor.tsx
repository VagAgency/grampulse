"use client";

import { useMemo, useState } from "react";
import { ModelEditModal } from "@/components/ModelEditModal";
import { parseModelDisplayName } from "@/lib/api";
import { DEFAULT_MODEL_EMOJI } from "@/lib/modelEmojis";

type Props = {
  modelId: number;
  name: string;
  onUpdated: (name: string) => void;
  as?: "h1" | "h3";
  className?: string;
};

export function ModelNameEditor({ modelId, name, onUpdated, as = "h3", className }: Props) {
  const [editing, setEditing] = useState(false);

  const parsed = useMemo(() => parseModelDisplayName(name), [name]);
  const TitleTag = as;
  const isPageTitle = as === "h1";

  return (
    <>
      <div
        className={`model-identity${isPageTitle ? " model-identity-page" : " model-identity-card"}${className ? ` ${className}` : ""}`}
      >
        <div className="model-identity-main">
          <span className="model-emoji-badge" aria-hidden>
            {parsed.emoji || DEFAULT_MODEL_EMOJI}
          </span>
          {isPageTitle ? (
            <TitleTag className="model-identity-name">{parsed.name || name}</TitleTag>
          ) : (
            <div className="model-identity-text">
              <TitleTag className="model-identity-name">{parsed.name || name}</TitleTag>
              <button
                type="button"
                className="model-edit-trigger"
                onClick={() => setEditing(true)}
              >
                Modifier
              </button>
            </div>
          )}
        </div>
        {isPageTitle && (
          <button
            type="button"
            className="model-edit-trigger"
            onClick={() => setEditing(true)}
          >
            Modifier
          </button>
        )}
      </div>

      <ModelEditModal
        open={editing}
        modelId={modelId}
        name={name}
        onClose={() => setEditing(false)}
        onSaved={onUpdated}
      />
    </>
  );
}
