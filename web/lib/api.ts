export const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "http://localhost:8000" : "http://localhost:8000");

export const SESSION_KEY = "grampulse_email";

export function getStoredEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setStoredEmail(email: string) {
  localStorage.setItem(SESSION_KEY, email.trim().toLowerCase());
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function authHeaders(email: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-User-Email": email,
  };
}

async function fetchApi(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(
      "Impossible de joindre l'API. Lance : cd api && uvicorn main:app --reload --port 8000"
    );
  }
}

export type HealthStatus = {
  status: string;
  instagram_mode: "mock" | "hiker" | "apify";
  mock_active: boolean;
  linkscale_configured?: boolean;
};

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetchApi(`${API}/health`);
  if (!res.ok) throw new Error("API indisponible");
  return res.json();
}

export type DailyViewsPoint = { date: string; views: number };
export type DailyFollowersPoint = { date: string; followers: number };
export type DailyClicksPoint = { date: string; clicks: number };
export type CountrySlice = { country: string; percent: number };

export type ReelPost = {
  url?: string | null;
  type?: string;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  views?: number | null;
  caption?: string | null;
  code?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  timestamp?: string | number | null;
  engagement?: number | null;
  conversion_score?: number | null;
  like_rate?: number | null;
  comment_rate?: number | null;
  followers_gained_est?: number | null;
  followers_gained_source?: "daily_delta" | "period_share" | "heuristic" | "none" | null;
};

export type LeaderboardVideo = ReelPost & {
  account_id?: number;
  account_handle?: string;
  model_id?: number;
  model_name?: string;
};

export type VideoSortMode = "performance" | "conversion";

export type ChartSeriesData = {
  id: number;
  name?: string;
  handle?: string;
  label?: string;
  model_id?: number;
  model_name?: string;
  followers?: number | null;
  daily_views: DailyViewsPoint[];
  daily_followers?: DailyFollowersPoint[];
  daily_clicks?: DailyClicksPoint[];
};

export type ModelSummary = {
  id: number;
  name: string;
  accounts_count: number;
  views_today: number;
};

export type AccountRow = {
  id: number;
  handle: string;
  display_name: string | null;
  status: string;
  followers: number | null;
  views_today: number;
  views_7d: number;
  views_prev_7d: number;
  views_change_pct: number | null;
  health_score: number | null;
  health_label: string | null;
  avg_engagement_rate: number | null;
  last_synced_at: string | null;
  va_id?: number | null;
  va_name?: string | null;
  va_emoji?: string | null;
  linkscale_url?: string | null;
  linkscale_host?: string | null;
  linkscale_slug?: string | null;
};

export type VaMember = {
  id: number;
  name: string;
  emoji?: string | null;
  created_at?: string;
  accounts_count?: number;
};

export type TeamRankingEntry = {
  rank: number;
  va_id: number;
  va_name: string;
  va_emoji?: string | null;
  accounts_count: number;
  views: number;
  followers: number;
  reels: number;
  posts: number;
  stories: number;
  publications: number;
  avg_engagement: number | null;
  accounts: Array<{
    id?: number;
    handle: string;
    model_name?: string;
    views?: number;
    reels?: number;
    posts?: number;
    stories?: number;
  }>;
};

export type SuiviAccountEntry = {
  account_id: number;
  handle: string;
  model_id?: number | null;
  model_name?: string | null;
  reels: number;
  posts: number;
  stories: number;
  total: number;
};

export type SuiviVaBlock = {
  va_id: number;
  va_name: string;
  va_emoji?: string | null;
  totals: { reels: number; posts: number; stories: number; total: number };
  accounts: SuiviAccountEntry[];
};

export type TeamSuivi = {
  date: string;
  prev_date: string;
  next_date: string;
  vas: SuiviVaBlock[];
  unassigned_accounts: SuiviAccountEntry[];
  notes?: string;
};

export type TeamRanking = {
  days: number;
  ranking: TeamRankingEntry[];
  unassigned_accounts: number;
  vas: VaMember[];
};

export type GlobalDashboard = {
  summary: {
    models_count: number;
    accounts_count: number;
    views_today: number;
    views_7d: number;
    by_status: Record<string, number>;
  };
  models: ModelSummary[];
  daily_views: DailyViewsPoint[];
  model_series: ChartSeriesData[];
  account_series: ChartSeriesData[];
  video_leaderboard: LeaderboardVideo[];
};

export type ModelDetail = {
  model: { id: number; name: string };
  accounts: AccountRow[];
  daily_views: DailyViewsPoint[];
  daily_followers: DailyFollowersPoint[];
  daily_clicks?: DailyClicksPoint[];
  account_series: ChartSeriesData[];
  video_leaderboard: LeaderboardVideo[];
  summary: {
    accounts_count: number;
    assigned_vas?: number;
    views_today: number;
    views_7d: number;
    actif: number;
    meilleur: number;
    shadowban: number;
    ban: number;
  };
};

export type AccountDetail = {
  account: AccountRow & { model_id: number };
  snapshot: {
    followers: number | null;
    health_score: number | null;
    top_posts: ReelPost[];
    all_posts?: ReelPost[];
    country_distribution?: CountrySlice[];
  } | null;
  daily_views: DailyViewsPoint[];
  daily_followers: DailyFollowersPoint[];
  daily_clicks?: DailyClicksPoint[];
  video_leaderboard?: LeaderboardVideo[];
};

export async function fetchDashboard(email: string, days = 90): Promise<GlobalDashboard> {
  const res = await fetchApi(`${API}/dashboard?days=${days}`, { headers: authHeaders(email) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Dashboard indisponible.");
  return data;
}

export async function createModel(email: string, name: string) {
  const res = await fetchApi(`${API}/models`, {
    method: "POST",
    headers: authHeaders(email),
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Création impossible.");
  return data.model;
}

export async function updateModel(email: string, modelId: number, name: string) {
  const res = await fetchApi(`${API}/models/${modelId}`, {
    method: "PATCH",
    headers: authHeaders(email),
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Mise à jour impossible.");
  return data.model;
}

export function parseModelDisplayName(full: string): { emoji: string; name: string } {
  const trimmed = full.trim();
  const match = trimmed.match(/^(\p{Extended_Pictographic}(?:\uFE0F)?)\s*(.*)$/u);
  if (match) {
    return { emoji: match[1], name: (match[2] || "").trim() };
  }
  return { emoji: "", name: trimmed };
}

export function formatModelDisplayName(emoji: string, name: string): string {
  const cleanName = name.trim();
  const cleanEmoji = emoji.trim();
  if (!cleanName) return cleanEmoji;
  if (!cleanEmoji) return cleanName;
  return `${cleanEmoji} ${cleanName}`;
}

export async function fetchModel(email: string, modelId: number, days = 90): Promise<ModelDetail> {
  const res = await fetchApi(`${API}/models/${modelId}?days=${days}`, { headers: authHeaders(email) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Modèle introuvable.");
  return data;
}

export async function addAccountToModel(email: string, modelId: number, handle: string) {
  const res = await fetchApi(`${API}/models/${modelId}/accounts`, {
    method: "POST",
    headers: authHeaders(email),
    body: JSON.stringify({ handle }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Ajout impossible.");
  return data;
}

export async function refreshAccount(email: string, modelId: number, handle: string) {
  const res = await fetchApi(
    `${API}/models/${modelId}/accounts/${encodeURIComponent(handle)}/refresh`,
    { method: "POST", headers: authHeaders(email) }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Actualisation impossible.");
  return data;
}

export type RefreshTarget = {
  handle: string;
  model_id: number;
  model_name: string | null;
};

export async function fetchRefreshTargets(email: string): Promise<{ accounts: RefreshTarget[] }> {
  const res = await fetchApi(`${API}/refresh/targets`, { headers: authHeaders(email) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Liste des comptes indisponible.");
  return data;
}

export type RefreshAllResult = {
  total: number;
  synced: number;
  results: Array<{ handle: string; model_id: number; ok: boolean }>;
  errors: Array<{ handle: string; model_id?: number; error: string }>;
  linkscale?: { synced?: number; error?: string };
};

export async function refreshAllAccounts(email: string): Promise<RefreshAllResult> {
  const res = await fetchApi(`${API}/refresh/all`, {
    method: "POST",
    headers: authHeaders(email),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Actualisation globale impossible.");
  return data;
}

export async function deleteModel(email: string, modelId: number) {
  const res = await fetchApi(`${API}/models/${modelId}`, {
    method: "DELETE",
    headers: authHeaders(email),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Suppression impossible.");
  }
}

export async function deleteAccount(email: string, modelId: number, handle: string) {
  const res = await fetchApi(`${API}/models/${modelId}/accounts/${encodeURIComponent(handle)}`, {
    method: "DELETE",
    headers: authHeaders(email),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Suppression impossible.");
  }
}

export async function fetchAccountDetail(
  email: string,
  modelId: number,
  handle: string,
  days = 30
): Promise<AccountDetail> {
  const res = await fetchApi(
    `${API}/models/${modelId}/accounts/${encodeURIComponent(handle)}?days=${days}`,
    { headers: authHeaders(email) }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Compte introuvable.");
  return data;
}

export async function fetchVas(email: string): Promise<VaMember[]> {
  const res = await fetchApi(`${API}/team/vas`, { headers: authHeaders(email) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "VAs indisponibles.");
  return data.vas;
}

export async function createVa(email: string, name: string, emoji?: string) {
  const res = await fetchApi(`${API}/team/vas`, {
    method: "POST",
    headers: authHeaders(email),
    body: JSON.stringify({ name, emoji }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Création VA impossible.");
  return data.va as VaMember;
}

export async function deleteVa(email: string, vaId: number) {
  const res = await fetchApi(`${API}/team/vas/${vaId}`, {
    method: "DELETE",
    headers: authHeaders(email),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Suppression VA impossible.");
  }
}

export async function assignAccountVa(
  email: string,
  modelId: number,
  handle: string,
  vaId: number | null
) {
  const res = await fetchApi(
    `${API}/models/${modelId}/accounts/${encodeURIComponent(handle)}/va`,
    {
      method: "PATCH",
      headers: authHeaders(email),
      body: JSON.stringify({ va_id: vaId }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Attribution VA impossible.");
  return data.account;
}

export async function assignAccountLinkscale(
  email: string,
  modelId: number,
  handle: string,
  linkscaleUrl: string | null
) {
  const res = await fetchApi(
    `${API}/models/${modelId}/accounts/${encodeURIComponent(handle)}/linkscale`,
    {
      method: "PATCH",
      headers: authHeaders(email),
      body: JSON.stringify({ linkscale_url: linkscaleUrl }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Lien Linkscale impossible.");
  return data;
}

export async function syncLinkscaleClicks(email: string, days = 90) {
  const res = await fetchApi(`${API}/linkscale/sync?days=${days}`, {
    method: "POST",
    headers: authHeaders(email),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Sync Linkscale impossible.");
  return data;
}

export async function fetchTeamRanking(email: string, days = 30): Promise<TeamRanking> {
  const res = await fetchApi(`${API}/team/ranking?days=${days}`, { headers: authHeaders(email) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Classement équipe indisponible.");
  return data;
}

export async function fetchTeamSuivi(email: string, date: string): Promise<TeamSuivi> {
  const res = await fetchApi(`${API}/team/suivi?date=${encodeURIComponent(date)}`, {
    headers: authHeaders(email),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Suivi indisponible.");
  return data;
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(2)}%`;
}

export function formatPostDate(ts: string | number | null | undefined): string {
  if (ts == null) return "—";
  try {
    const d = parsePostDate(ts);
    if (!d) return "—";
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function parsePostDate(ts: string | number | null | undefined): Date | null {
  if (ts == null || ts === "") return null;
  if (typeof ts === "number") {
    const d = new Date(ts < 1e12 ? ts * 1000 : ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const asNum = Number(ts);
  if (!Number.isNaN(asNum) && String(ts).trim() !== "") {
    const d = new Date(asNum < 1e12 ? asNum * 1000 : asNum);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function postDateKey(ts: string | number | null | undefined): string | null {
  const d = parsePostDate(ts);
  return d ? formatLocalDate(d) : null;
}

export function periodCutoffDate(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return formatLocalDate(d);
}

export function periodEndDate(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return formatLocalDate(d);
}

export function getAccountPosts(snapshot: AccountDetail["snapshot"]): ReelPost[] {
  if (!snapshot) return [];
  if (snapshot.all_posts && snapshot.all_posts.length > 0) return snapshot.all_posts;
  return snapshot.top_posts || [];
}

export function isPostInPeriod(
  post: { timestamp?: string | number | null },
  days: number
): boolean {
  const key = postDateKey(post.timestamp);
  if (!key) return false;
  return key >= periodCutoffDate(days) && key <= periodEndDate();
}

export function filterPostsByDays<T extends ReelPost>(posts: T[], days: number): T[] {
  return posts
    .filter((p) => isPostInPeriod(p, days))
    .sort((a, b) => (b.views || 0) - (a.views || 0));
}

export function filterLeaderboardByDays<T extends { timestamp?: string | number | null }>(
  videos: T[],
  days: number
): T[] {
  return videos.filter((v) => isPostInPeriod(v, days));
}

export function filterPostsInPreviousPeriod<T extends ReelPost>(posts: T[], days: number): T[] {
  const currentStart = periodCutoffDate(days);
  const prevEnd = new Date(`${currentStart}T00:00:00`);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  const startKey = formatLocalDate(prevStart);
  const endKey = formatLocalDate(prevEnd);

  return posts.filter((p) => {
    const key = postDateKey(p.timestamp);
    return Boolean(key && key >= startKey && key <= endKey);
  });
}

export function filterDailyByDays<T extends { date: string }>(points: T[], days: number): T[] {
  const cutoff = periodCutoffDate(days);
  const end = periodEndDate();
  return points.filter((p) => p.date >= cutoff && p.date <= end);
}

export function fillSeriesForPeriod(points: DailyViewsPoint[], days: number): DailyViewsPoint[] {
  const byDay = new Map(points.map((p) => [p.date, p.views]));
  return listPeriodDates(days).map((date) => ({
    date,
    views: byDay.get(date) || 0,
  }));
}

export function fillFollowersSeriesForPeriod(
  points: DailyFollowersPoint[],
  days: number
): DailyViewsPoint[] {
  const byDay = new Map(points.map((p) => [p.date, p.followers]));
  const dates = listPeriodDates(days);
  let last = 0;
  return dates.map((date) => {
    if (byDay.has(date)) last = byDay.get(date)!;
    return { date, views: last };
  });
}

export function fillClicksSeriesForPeriod(
  points: DailyClicksPoint[],
  days: number
): DailyViewsPoint[] {
  const byDay = new Map(points.map((p) => [p.date, p.clicks]));
  return listPeriodDates(days).map((date) => ({
    date,
    views: byDay.get(date) || 0,
  }));
}

export function sumDailyViews(points: DailyViewsPoint[], days: number): number {
  return filterDailyByDays(points, days).reduce((sum, p) => sum + p.views, 0);
}

export function sumDailyClicks(points: DailyClicksPoint[] | undefined, days: number): number {
  if (!points?.length) return 0;
  const cutoff = periodCutoffDate(days);
  const end = periodEndDate();
  return points
    .filter((p) => p.date >= cutoff && p.date <= end)
    .reduce((sum, p) => sum + (p.clicks || 0), 0);
}

export function sumLatestFollowers(
  accounts: Array<{ followers?: number | null }>
): number {
  return accounts.reduce((sum, a) => sum + (a.followers || 0), 0);
}

export function listPeriodDates(days: number): string[] {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function postsToDailyViews(posts: ReelPost[]): DailyViewsPoint[] {
  const byDay: Record<string, number> = {};
  for (const post of posts) {
    const key = postDateKey(post.timestamp);
    if (!key) continue;
    byDay[key] = (byDay[key] || 0) + (post.views || 0);
  }
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, views]) => ({ date, views }));
}

/** Courbe sur TOUS les jours de la période (0 si aucun post ce jour-là). */
export function postsToPeriodChart(posts: ReelPost[], days: number): DailyViewsPoint[] {
  const byDay: Record<string, number> = {};
  for (const post of posts) {
    const key = postDateKey(post.timestamp);
    if (!key) continue;
    byDay[key] = (byDay[key] || 0) + (post.views || 0);
  }
  return listPeriodDates(days).map((date) => ({
    date,
    views: byDay[date] || 0,
  }));
}

export type PeriodSummary = {
  posts: ReelPost[];
  views: number;
  likes: number;
  comments: number;
  activeDays: number;
  emptyDays: number;
  chartViews: DailyViewsPoint[];
  engagement: number | null;
  viewsChange: number | null;
  oldestInPeriod: string | null;
  newestInPeriod: string | null;
};

export function buildPeriodSummary(
  allPosts: ReelPost[],
  days: number,
  followers: number | null | undefined
): PeriodSummary {
  const posts = filterPostsByDays(allPosts, days);
  const chartViews = postsToPeriodChart(posts, days);
  const activeDays = chartViews.filter((d) => d.views > 0).length;
  const dates = posts.map((p) => postDateKey(p.timestamp)).filter(Boolean) as string[];

  return {
    posts,
    views: sumPostViews(posts),
    likes: sumPostLikes(posts),
    comments: sumPostComments(posts),
    activeDays,
    emptyDays: days - activeDays,
    chartViews,
    engagement: computePeriodEngagement(posts, followers),
    viewsChange: computePeriodViewsChange(allPosts, days),
    oldestInPeriod: dates.length ? dates.sort()[0] : null,
    newestInPeriod: dates.length ? dates.sort().at(-1) ?? null : null,
  };
}

export function formatPeriodInsight(summary: PeriodSummary, days: number): string {
  if (!summary.posts.length) {
    return `Aucun reel publié sur les ${days} derniers jours.`;
  }
  const parts = [
    `${summary.posts.length} reel(s)`,
    `${summary.activeDays} jour(s) avec publication`,
    `${formatNumber(summary.views)} vues`,
  ];
  if (summary.emptyDays > 0) {
    parts.push(`${summary.emptyDays} jour(s) sans post`);
  }
  return parts.join(" · ");
}

export function sumPostViews(posts: Array<{ views?: number | null }>): number {
  return posts.reduce((sum, p) => sum + (p.views || 0), 0);
}

export function sumPostLikes(posts: Array<{ likes?: number | null }>): number {
  return posts.reduce((sum, p) => sum + (p.likes || 0), 0);
}

export function sumPostComments(posts: Array<{ comments?: number | null }>): number {
  return posts.reduce((sum, p) => sum + (p.comments || 0), 0);
}

export function computePeriodEngagement(
  posts: ReelPost[],
  followers: number | null | undefined
): number | null {
  if (!posts.length || !followers) return null;
  const total = posts.reduce((sum, p) => sum + (p.likes || 0) + (p.comments || 0), 0);
  return (total / posts.length / followers) * 100;
}

export function computePeriodViewsChange(posts: ReelPost[], days: number): number | null {
  const current = sumPostViews(filterPostsByDays(posts, days));
  const previous = sumPostViews(filterPostsInPreviousPeriod(posts, days));
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export function formatPeriodLabel(days: number): string {
  const start = periodCutoffDate(days);
  const end = periodEndDate();
  const fmt = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };
  return `${fmt(start)} → ${fmt(end)}`;
}

export function sortVideoLeaderboard(
  posts: LeaderboardVideo[],
  mode: VideoSortMode
): LeaderboardVideo[] {
  const sorted = [...posts];
  if (mode === "conversion") {
    sorted.sort(
      (a, b) =>
        (b.conversion_score || 0) - (a.conversion_score || 0) ||
        (b.views || 0) - (a.views || 0) ||
        (b.likes || 0) - (a.likes || 0)
    );
  } else {
    sorted.sort(
      (a, b) =>
        (b.views || 0) - (a.views || 0) ||
        (b.conversion_score || 0) - (a.conversion_score || 0) ||
        (b.likes || 0) - (a.likes || 0)
    );
  }
  return sorted;
}

export function followersEstHint(source?: LeaderboardVideo["followers_gained_source"]): string {
  if (source === "daily_delta") return "Estimation basée sur la hausse d'abonnés le jour de publication.";
  if (source === "period_share") return "Estimation répartie selon l'engagement sur la période.";
  if (source === "heuristic") return "Estimation basée sur likes et commentaires (Instagram ne fournit pas ce chiffre).";
  return "Estimation indisponible.";
}
