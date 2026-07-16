export const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "https://api.grampulse.com" : "http://localhost:8000");

export type SubscriptionStatus = {
  email: string;
  active: boolean;
  plan: string | null;
  price_label: string | null;
  dev_account: boolean;
  whop_configured: boolean;
  member_since: string | null;
  has_billing: boolean;
  manage_url: string | null;
};

async function fetchApi(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(
      "Impossible de joindre l'API. Vérifie que le serveur est en ligne."
    );
  }
}

export async function createCheckout(email: string): Promise<string> {
  const res = await fetchApi(`${API}/whop/checkout?email=${encodeURIComponent(email)}`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Erreur lors de l'abonnement.");
  return data.url;
}

export async function syncSubscription(email: string): Promise<{ email: string; active: boolean }> {
  const res = await fetchApi(`${API}/whop/sync-subscription?email=${encodeURIComponent(email)}`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Synchronisation impossible.");
  }
  return res.json();
}

export async function fetchSubscriptionStatus(email: string): Promise<SubscriptionStatus> {
  const res = await fetchApi(`${API}/whop/status`, {
    headers: { "X-User-Email": email },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Impossible de charger le compte.");
  }
  return res.json();
}

export function formatMemberSince(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}
