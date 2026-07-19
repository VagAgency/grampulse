"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  onFile: (file: File) => void;
  disabled?: boolean;
  uploading?: boolean;
  previewUrl?: string | null;
  label?: string;
  compact?: boolean;
};

export function VideoDropZone({
  onFile,
  disabled,
  uploading,
  previewUrl,
  label = "Vidéo modèle",
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pickFile = useCallback(
    (file: File | null | undefined) => {
      if (!file || disabled || uploading) return;
      if (!file.type.startsWith("video/") && !/\.(mp4|mov|webm|m4v)$/i.test(file.name)) {
        return;
      }
      onFile(file);
    },
    [disabled, uploading, onFile]
  );

  return (
    <div className={`planning-drop-wrap${compact ? " is-compact" : ""}`}>
      {!compact ? <p className="planning-drop-label">{label}</p> : null}
      <div
        className={`planning-drop-zone${dragOver ? " is-dragover" : ""}${disabled ? " is-disabled" : ""}${compact ? " is-compact" : ""}`}
        title={compact ? label : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => {
          if (!disabled && !uploading) inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        {previewUrl ? (
          <video src={previewUrl} className="planning-drop-preview" muted playsInline preload="metadata" />
        ) : (
          <div className="planning-drop-placeholder">
            <span className="planning-drop-icon">+</span>
            {!compact ? <span>{uploading ? "Envoi…" : "Glisser ou cliquer"}</span> : null}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="video/*,.mp4,.mov,.webm,.m4v"
          className="planning-drop-input"
          disabled={disabled || uploading}
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
