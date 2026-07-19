"use client";

import {
  ContentPlan,
  deleteContentPlan,
  downloadPlanMedia,
  planModelMediaUrl,
  planSourceMediaUrl,
  refetchContentPlanSource,
  uploadPlanModelVideo,
} from "@/lib/api";
import { VideoDropZone } from "@/components/VideoDropZone";
import { useState } from "react";

type Props = {
  email: string;
  plan: ContentPlan;
  onChange: () => void;
};

export function ContentPlanCard({ email, plan, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sourceUrl = planSourceMediaUrl(plan);
  const modelUrl = planModelMediaUrl(plan);
  const title = plan.title || plan.source_url;

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
    if (!window.confirm("Supprimer ce plan ?")) return;
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
          <h3 className="planning-card-title">{title}</h3>
          <p className="planning-card-meta">
            {plan.model_name ? `${plan.model_name} · ` : ""}
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
