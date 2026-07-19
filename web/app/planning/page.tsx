"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AppPageHeader } from "@/components/AppPageHeader";
import { ContentPlanCard } from "@/components/ContentPlanCard";
import {
  ContentPlan,
  ModelSummary,
  createContentPlan,
  fetchContentPlans,
  fetchDashboard,
  getStoredEmail,
} from "@/lib/api";

export default function PlanningPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("");
  const [modelId, setModelId] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState("");

  const load = useCallback(async (userEmail: string) => {
    setError("");
    try {
      const [planList, dashboard] = await Promise.all([
        fetchContentPlans(userEmail),
        fetchDashboard(userEmail, 7),
      ]);
      setPlans(planList);
      setModels(dashboard.models || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredEmail();
    if (!stored) {
      router.replace("/login");
      return;
    }
    setEmail(stored);
    void load(stored);
  }, [router, load]);

  useEffect(() => {
    if (!email) return;
    const pending = plans.some(
      (p) => p.source_status === "pending" || p.source_status === "downloading"
    );
    if (!pending) return;
    const timer = window.setInterval(() => {
      void load(email);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [email, plans, load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!email || !sourceUrl.trim()) return;
    setCreating(true);
    setError("");
    try {
      await createContentPlan(email, {
        source_url: sourceUrl.trim(),
        title: title.trim() || undefined,
        model_id: modelId ? Number(modelId) : undefined,
        scheduled_at: scheduledAt || undefined,
      });
      setSourceUrl("");
      setTitle("");
      setScheduledAt("");
      await load(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell email={email} active="planning">
      <AppPageHeader
        eyebrow="Montage mobile"
        title={
          <>
            Planning <span className="gradient-text">contenu</span>
          </>
        }
        subtitle="Colle un lien, récupère la vidéo originale, ajoute la vidéo de ta modèle — télécharge les deux depuis ton téléphone."
      />

      {error ? <p className="status err">{error}</p> : null}

      <form className="card planning-create-form" onSubmit={(e) => void onCreate(e)}>
        <h2 className="planning-form-title">Nouvelle vidéo</h2>
        <div className="planning-form-grid">
          <label className="planning-field planning-field-wide">
            <span>Lien de la vidéo (Instagram, TikTok…)</span>
            <input
              type="url"
              required
              placeholder="https://www.instagram.com/reel/…"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="linkscale-input"
            />
          </label>
          <label className="planning-field">
            <span>Titre (optionnel)</span>
            <input
              type="text"
              placeholder="Reel du lundi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="linkscale-input"
            />
          </label>
          <label className="planning-field">
            <span>Modèle</span>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="linkscale-input"
            >
              <option value="">— Aucune —</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="planning-field">
            <span>Date prévue</span>
            <input
              type="date"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="linkscale-input"
            />
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? "Ajout…" : "Ajouter au planning"}
        </button>
      </form>

      {loading ? (
        <p className="hint">Chargement…</p>
      ) : plans.length === 0 ? (
        <p className="hint">Aucune vidéo planifiée — ajoute un lien ci-dessus.</p>
      ) : (
        <div className="planning-list">
          {plans.map((plan) => (
            <ContentPlanCard key={plan.id} email={email!} plan={plan} onChange={() => void load(email!)} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
