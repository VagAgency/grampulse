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
} from "@/lib/api";
import { VideoDropZone } from "@/components/VideoDropZone";
import { useState, type ReactNode } from "react";

type Props = {
  email: string;
  plan: ContentPlan;
  searchQuery?: string;
  onChange: () => void;
};

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
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingText, setEditingText] = useState(false);
  const [draftText, setDraftText] = useState(plan.video_text || "");

  const sourceUrl = planSourceMediaUrl(plan);
  const modelUrl = planModelMediaUrl(plan);
  const title = plan.title || "Sans titre";

  async function onUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      await uploadPlanModelVideo(email, plan.id, file);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload impossible.");
    } finally {
      setUploading(false);
    }
  }

  async function onDownload(kind: "source" | "model") {
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

  async function onDelete() {
    if (!window.confirm("Supprimer cette vidéo de la bibliothèque ?")) return;
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

  const sourceStatusLabel =
    plan.source_status === "ready"
      ? "Prête"
      : plan.source_status === "downloading"
        ? "Téléchargement…"
        : plan.source_status === "failed"
          ? "Échec"
          : "En attente";

  return (
    <article className="card planning-card">
      <header className="planning-card-head">
        <div>
          <h3 className="planning-card-title">{highlightText(title, searchQuery)}</h3>
          <p className="planning-card-meta">
            {plan.model_name ? (
              <span className="library-model-badge">{plan.model_name}</span>
            ) : (
              "Sans modèle"
            )}
            {" · "}
            {plan.scheduled_at
              ? new Date(`${plan.scheduled_at}T12:00:00`).toLocaleDateString("fr-FR")
              : "Sans date"}
            {" · "}
            <span className={`planning-status planning-status-${plan.source_status}`}>{sourceStatusLabel}</span>
          </p>
          <a href={plan.source_url} target="_blank" rel="noopener noreferrer" className="planning-source-link">
            {plan.source_url}
          </a>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void onDelete()}>
          Suppr.
        </button>
      </header>

      {(plan.video_text || editingText) && (
        <div className="library-text-block">
          <div className="library-text-head">
            <span className="planning-col-label">Texte du reel</span>
            {!editingText ? (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditingText(true)}>
                Modifier
              </button>
            ) : null}
          </div>
          {editingText ? (
            <>
              <textarea
                rows={4}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                className="linkscale-input library-textarea"
              />
              <div className="library-text-actions">
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void onSaveText()}>
                  Enregistrer
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
          ) : (
            <p className="library-text-content">{highlightText(plan.video_text || "", searchQuery)}</p>
          )}
        </div>
      )}

      {!plan.video_text && !editingText ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm library-add-text-btn"
          disabled={busy}
          onClick={() => setEditingText(true)}
        >
          + Ajouter le texte du reel
        </button>
      ) : null}

      {plan.source_error ? <p className="status err">{plan.source_error}</p> : null}
      {error ? <p className="status err">{error}</p> : null}

      <div className="planning-video-pair">
        <div className="planning-video-col">
          <p className="planning-col-label">Vidéo originale</p>
          {sourceUrl ? (
            <video src={sourceUrl} className="planning-video" controls playsInline preload="metadata" />
          ) : (
            <div className="planning-video-placeholder">
              {plan.source_status === "downloading" || plan.source_status === "pending" ? (
                <span>Téléchargement en cours…</span>
              ) : (
                <>
                  <span>Indisponible</span>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void onRefetch()}>
                    Réessayer
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <VideoDropZone
          label="Vidéo modèle"
          onFile={(file) => void onUpload(file)}
          uploading={uploading}
          disabled={busy}
          previewUrl={modelUrl}
        />
      </div>

      <div className="planning-download-bar">
        <button
          type="button"
          className="btn btn-primary planning-download-btn"
          disabled={!sourceUrl || busy}
          onClick={() => void onDownload("source")}
        >
          Télécharger original
        </button>
        <button
          type="button"
          className="btn btn-primary planning-download-btn"
          disabled={!modelUrl || busy}
          onClick={() => void onDownload("model")}
        >
          Télécharger modèle
        </button>
      </div>
    </article>
  );
}
