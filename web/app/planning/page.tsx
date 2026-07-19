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
  const [videoText, setVideoText] = useState("");
  const [modelId, setModelId] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModelId, setFilterModelId] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const loadPlans = useCallback(
    async (userEmail: string, q?: string, filterModel?: string) => {
      setError("");
      try {
        const planList = await fetchContentPlans(userEmail, {
          q: q || undefined,
          modelId: filterModel ? Number(filterModel) : undefined,
        });
        setPlans(planList);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    },
    []
  );

  const load = useCallback(
    async (userEmail: string, q?: string, filterModel?: string) => {
      setLoading(true);
      try {
        const dashboard = await fetchDashboard(userEmail, 7);
        setModels(dashboard.models || []);
        await loadPlans(userEmail, q, filterModel);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      } finally {
        setLoading(false);
      }
    },
    [loadPlans]
  );

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
    const timer = window.setTimeout(() => {
      void loadPlans(email, searchQuery, filterModelId);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [email, searchQuery, filterModelId, loadPlans]);

  useEffect(() => {
    if (!email) return;
    const pending = plans.some(
      (p) => p.source_status === "pending" || p.source_status === "downloading"
    );
    if (!pending) return;
    const timer = window.setInterval(() => {
      void loadPlans(email, searchQuery, filterModelId);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [email, plans, searchQuery, filterModelId, loadPlans]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!email || !sourceUrl.trim()) return;
    setCreating(true);
    setError("");
    try {
      await createContentPlan(email, {
        source_url: sourceUrl.trim(),
        title: title.trim() || undefined,
        video_text: videoText.trim() || undefined,
        model_id: modelId ? Number(modelId) : undefined,
        scheduled_at: scheduledAt || undefined,
      });
      setSourceUrl("");
      setTitle("");
      setVideoText("");
      setScheduledAt("");
      setShowAddForm(false);
      await loadPlans(email, searchQuery, filterModelId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setCreating(false);
    }
  }

  const hasFilters = Boolean(searchQuery.trim() || filterModelId);

  return (
    <AppShell email={email} active="planning">
      <AppPageHeader
        eyebrow="Montage mobile"
        title={
          <>
            Bibliothèque <span className="gradient-text">contenu</span>
          </>
        }
        subtitle="Stocke tes vidéos, le texte du reel et la vidéo modèle — retrouve tout par recherche ou filtre modèle."
      />

      {error ? <p className="status err">{error}</p> : null}

      <div className="card library-search-bar">
        <div className="library-search-row">
          <label className="library-search-field">
            <span className="sr-only">Rechercher</span>
            <input
              type="search"
              placeholder="Rechercher titre, texte du reel, mots-clés…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="linkscale-input"
            />
          </label>
          <label className="library-filter-field">
            <span>Modèle</span>
            <select
              value={filterModelId}
              onChange={(e) => setFilterModelId(e.target.value)}
              className="linkscale-input"
            >
              <option value="">Toutes les modèles</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {hasFilters ? (
          <p className="hint library-search-hint">
            {plans.length} résultat{plans.length !== 1 ? "s" : ""}
            {" · "}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearchQuery("");
                setFilterModelId("");
              }}
            >
              Effacer les filtres
            </button>
          </p>
        ) : null}
      </div>

      <div className="library-add-toggle">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? "Masquer le formulaire" : "+ Ajouter une vidéo"}
        </button>
      </div>

      {showAddForm ? (
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
            <label className="planning-field planning-field-wide">
              <span>Texte de la vidéo</span>
              <textarea
                rows={5}
                placeholder="Colle ici le script, la voix off ou les phrases clés du reel pour retrouver cette vidéo plus tard…"
                value={videoText}
                onChange={(e) => setVideoText(e.target.value)}
                className="linkscale-input library-textarea"
              />
            </label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? "Ajout…" : "Ajouter à la bibliothèque"}
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className="hint">Chargement…</p>
      ) : plans.length === 0 ? (
        <p className="hint">
          {hasFilters
            ? "Aucune vidéo ne correspond à ta recherche."
            : "Bibliothèque vide — ajoute ta première vidéo."}
        </p>
      ) : (
        <div className="planning-list">
          {plans.map((plan) => (
            <ContentPlanCard
              key={plan.id}
              email={email!}
              plan={plan}
              searchQuery={searchQuery}
              onChange={() => void loadPlans(email!, searchQuery, filterModelId)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
