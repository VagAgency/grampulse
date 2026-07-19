"use client";

import {
  ContentPlan,
  deleteContentPlan,
  downloadPlanMedia,
  planModelMediaUrl,
  planSourceMediaUrl,
  refetchContentPlanSource,
  updateContentPlan,
  uploadPlanModelVideo,
  uploadPlanSourceVideo,
} from "@/lib/api";
import { VideoDropZone } from "@/components/VideoDropZone";
import { useState, type ReactNode } from "react";

type Props = {
  email: string;
  plan: ContentPlan;
  searchQuery?: string;
  onChange: () => void;
};

function isInstagramUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith("instagram.com") || host.endsWith("instagr.am");
  } catch {
    return false;
  }
}

function highlightText(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q || !text) return text;
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.length) return text;
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);
  const lowerWords = new Set(words.map((w) => w.toLowerCase()));
  return parts.map((part, i) =>
    lowerWords.has(part.toLowerCase()) ? (
      <mark key={i} className="library-highlight">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function ContentPlanCard({ email, plan, searchQuery = "", onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [uploadingSource, setUploadingSource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingText, setEditingText] = useState(false);
  const [draftText, setDraftText] = useState(plan.video_text || "");
  const [copied, setCopied] = useState(false);

  const sourceUrl = planSourceMediaUrl(plan);
  const modelUrl = planModelMediaUrl(plan);
  const isInstagram = isInstagramUrl(plan.source_url);
  const title = plan.title || "Sans titre";
  const dateLabel = plan.scheduled_at
    ? new Date(`${plan.scheduled_at}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
    : null;

  async function onUploadModel(file: File) {
    setUploadingModel(true);
    setError("");
    try {
      await uploadPlanModelVideo(email, plan.id, file);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload impossible.");
    } finally {
      setUploadingModel(false);
    }
  }

  async function onUploadSource(file: File) {
    setUploadingSource(true);
    setError("");
    try {
      await uploadPlanSourceVideo(email, plan.id, file);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload impossible.");
    } finally {
      setUploadingSource(false);
    }
  }

  async function onDownload(kind: "source" | "model", e?: React.MouseEvent) {
    e?.stopPropagation();
    const url =
      kind === "source" ? planSourceMediaUrl(plan, true) : planModelMediaUrl(plan, true);
    if (!url) return;
    setBusy(true);
    setError("");
    try {
      await downloadPlanMedia(url, kind === "source" ? `original-${plan.id}.mp4` : `modele-${plan.id}.mp4`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Téléchargement impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function onRefetch() {
    setBusy(true);
    setError("");
    try {
      await refetchContentPlanSource(email, plan.id);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!window.confirm("Supprimer cette vidéo ?")) return;
    setBusy(true);
    try {
      await deleteContentPlan(email, plan.id);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveText() {
    setBusy(true);
    setError("");
    try {
      await updateContentPlan(email, plan.id, { video_text: draftText.trim() || "" });
      setEditingText(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sauvegarde impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function onCopyLink(e?: React.MouseEvent) {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(plan.source_url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Impossible de copier le lien.");
    }
  }

  const statusDot =
    sourceUrl || plan.source_status === "ready"
      ? "ready"
      : isInstagram || plan.source_status === "link"
        ? "link"
        : plan.source_status === "failed"
          ? "failed"
          : "pending";

  const showSourceError = plan.source_error && !isInstagram;

  return (
    <article className={`library-item${expanded ? " is-expanded" : ""}`}>
      <div
        className="library-item-row"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className="library-thumbs">
          <div className="library-thumb library-thumb-source">
            {sourceUrl ? (
              <video src={sourceUrl} muted playsInline preload="metadata" />
            ) : (
              <span className="library-thumb-empty">{isInstagram ? "⎘" : plan.source_status === "downloading" ? "…" : "?"}</span>
            )}
          </div>
          <div className="library-thumb library-thumb-model">
            {modelUrl ? (
              <video src={modelUrl} muted playsInline preload="metadata" />
            ) : (
              <span className="library-thumb-empty">+</span>
            )}
          </div>
        </div>

        <div className="library-item-main">
          <div className="library-item-topline">
            <h3 className="library-item-title">{highlightText(title, searchQuery)}</h3>
            {plan.model_name ? <span className="library-model-badge">{plan.model_name}</span> : null}
            {dateLabel ? <span className="library-item-date">{dateLabel}</span> : null}
            <span className={`library-status-dot is-${statusDot}`} title={plan.source_status} />
          </div>
          {plan.video_text ? (
            <p className="library-item-snippet">{highlightText(plan.video_text, searchQuery)}</p>
          ) : (
            <p className="library-item-snippet is-muted">
              {isInstagram && !sourceUrl ? "Lien Instagram — clique pour copier" : "Pas de texte — clique pour ouvrir"}
            </p>
          )}
        </div>

        <div className="library-item-quick" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`library-icon-btn${copied ? " is-active" : ""}`}
            title={copied ? "Copié !" : "Copier le lien"}
            disabled={busy}
            onClick={(e) => void onCopyLink(e)}
          >
            {copied ? "✓" : "⎘"}
          </button>
          <button
            type="button"
            className="library-icon-btn"
            title="Télécharger original"
            disabled={!sourceUrl || busy}
            onClick={(e) => void onDownload("source", e)}
          >
            ↓O
          </button>
          <button
            type="button"
            className="library-icon-btn"
            title="Télécharger modèle"
            disabled={!modelUrl || busy}
            onClick={(e) => void onDownload("model", e)}
          >
            ↓M
          </button>
          <button type="button" className="library-icon-btn is-danger" title="Supprimer" disabled={busy} onClick={(e) => void onDelete(e)}>
            ×
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="library-item-detail">
          {error ? <p className="status err">{error}</p> : null}
          {showSourceError ? <p className="status err">{plan.source_error}</p> : null}

          {isInstagram && !sourceUrl ? (
            <p className="library-hint">
              Copie le lien Instagram, télécharge la vidéo où tu veux, puis dépose-la dans « Original ».
            </p>
          ) : null}

          <div className="library-detail-text">
            <div className="library-text-head">
              <span className="planning-col-label">Texte</span>
              {!editingText ? (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditingText(true)}>
                  Modifier
                </button>
              ) : null}
            </div>
            {editingText ? (
              <>
                <textarea
                  rows={3}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  className="linkscale-input library-textarea"
                />
                <div className="library-text-actions">
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void onSaveText()}>
                    OK
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => {
                      setDraftText(plan.video_text || "");
                      setEditingText(false);
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </>
            ) : plan.video_text ? (
              <p className="library-text-content">{highlightText(plan.video_text, searchQuery)}</p>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditingText(true)}>
                + Texte du reel
              </button>
            )}
          </div>

          <div className="library-detail-videos">
            <div className="library-detail-video">
              {sourceUrl ? (
                <>
                  <span className="planning-col-label">Original</span>
                  <video src={sourceUrl} className="library-detail-player" controls playsInline preload="metadata" />
                </>
              ) : (
                <VideoDropZone
                  compact
                  label={isInstagram ? "Original — glisser ici" : "Original — glisser ici"}
                  onFile={(file) => void onUploadSource(file)}
                  uploading={uploadingSource}
                  disabled={busy}
                />
              )}
            </div>
            <div className="library-detail-video">
              <VideoDropZone
                compact
                label="Modèle — glisser ici"
                onFile={(file) => void onUploadModel(file)}
                uploading={uploadingModel}
                disabled={busy}
                previewUrl={modelUrl}
              />
            </div>
          </div>

          <div className="library-detail-foot">
            <div className="library-source-link-row">
              <a href={plan.source_url} target="_blank" rel="noopener noreferrer" className="planning-source-link">
                {plan.source_url}
              </a>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void onCopyLink()}>
                {copied ? "Copié !" : "Copier le lien"}
              </button>
            </div>
            <div className="library-detail-dl">
              {!isInstagram && !sourceUrl ? (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void onRefetch()}>
                  Réessayer
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost btn-sm" disabled={!sourceUrl || busy} onClick={() => void onDownload("source")}>
                ↓ Original
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!modelUrl || busy} onClick={() => void onDownload("model")}>
                ↓ Modèle
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
