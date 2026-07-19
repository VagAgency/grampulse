"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  const [allPlans, setAllPlans] = useState<ContentPlan[]>([]);
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

  const modelCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allPlans.length, none: 0 };
    for (const m of models) counts[String(m.id)] = 0;
    for (const p of allPlans) {
      if (p.model_id) counts[String(p.model_id)] = (counts[String(p.model_id)] || 0) + 1;
      else counts.none += 1;
    }
    return counts;
  }, [allPlans, models]);

  const loadPlans = useCallback(
    async (userEmail: string, q?: string, filterModel?: string) => {
      setError("");
      try {
        const filterOpts =
          filterModel === "none"
            ? { unassigned: true as const }
            : filterModel
              ? { modelId: Number(filterModel) }
              : {};
        const [filtered, all] = await Promise.all([
          fetchContentPlans(userEmail, { q: q || undefined, ...filterOpts }),
          fetchContentPlans(userEmail),
        ]);
        setPlans(filtered);
        setAllPlans(all);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    },
    []
  );

  const load = useCallback(
    async (userEmail: string) => {
      setLoading(true);
      try {
        const dashboard = await fetchDashboard(userEmail, 7);
        setModels(dashboard.models || []);
        await loadPlans(userEmail, searchQuery, filterModelId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      } finally {
        setLoading(false);
      }
    },
    [loadPlans, searchQuery, filterModelId]
  );

  useEffect(() => {
    const stored = getStoredEmail();
    if (!stored) {
      router.replace("/login");
      return;
    }
    setEmail(stored);
    void load(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

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
        eyebrow="Bibliothèque"
        title={
          <>
            Contenu <span className="gradient-text">modèles</span>
          </>
        }
        subtitle="Vue compacte — filtre par modèle, cherche par titre ou texte, clique une ligne pour le détail. Les liens Instagram sont téléchargés via SnapInsta. Indépendant des boutons ↻ Comptes / ↻ Vidéos du dashboard."
      />

      {error ? <p className="status err">{error}</p> : null}

      <div className="library-toolbar card">
        <div className="library-toolbar-row">
          <input
            type="search"
            placeholder="Rechercher…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="linkscale-input library-search-input"
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? "Fermer" : "+ Vidéo"}
          </button>
        </div>

        <div className="library-model-tabs" role="tablist" aria-label="Filtrer par modèle">
          <button
            type="button"
            role="tab"
            aria-selected={filterModelId === ""}
            className={`library-model-tab${filterModelId === "" ? " active" : ""}`}
            onClick={() => setFilterModelId("")}
          >
            Toutes
            <span className="library-model-count">{modelCounts.all}</span>
          </button>
          {models.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={filterModelId === String(m.id)}
              className={`library-model-tab${filterModelId === String(m.id) ? " active" : ""}`}
              onClick={() => setFilterModelId(String(m.id))}
            >
              {m.name}
              <span className="library-model-count">{modelCounts[String(m.id)] || 0}</span>
            </button>
          ))}
          {(modelCounts.none || 0) > 0 ? (
            <button
              type="button"
              role="tab"
              aria-selected={filterModelId === "none"}
              className={`library-model-tab${filterModelId === "none" ? " active" : ""}`}
              onClick={() => setFilterModelId("none")}
            >
              Sans modèle
              <span className="library-model-count">{modelCounts.none}</span>
            </button>
          ) : null}
        </div>

        {hasFilters ? (
          <p className="hint library-toolbar-hint">
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
              Effacer
            </button>
          </p>
        ) : null}
      </div>

      {showAddForm ? (
        <form className="card planning-create-form is-compact" onSubmit={(e) => void onCreate(e)}>
          <div className="planning-form-grid">
            <label className="planning-field planning-field-wide">
              <span>Lien</span>
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
              <span>Titre</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="linkscale-input" />
            </label>
            <label className="planning-field">
              <span>Modèle</span>
              <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="linkscale-input">
                <option value="">—</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="planning-field">
              <span>Date</span>
              <input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="linkscale-input" />
            </label>
            <label className="planning-field planning-field-wide">
              <span>Texte du reel</span>
              <textarea
                rows={3}
                value={videoText}
                onChange={(e) => setVideoText(e.target.value)}
                className="linkscale-input library-textarea"
              />
            </label>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
            {creating ? "…" : "Ajouter"}
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className="hint">Chargement…</p>
      ) : plans.length === 0 ? (
        <p className="hint">{hasFilters ? "Aucun résultat." : "Bibliothèque vide."}</p>
      ) : (
        <div className="library-list">
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
