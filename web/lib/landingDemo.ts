/** Données démo landing — comptes et modèles réels GramPulse */

export type LandingModel = {
  emoji: string;
  name: string;
  handles: string[];
};

export const LANDING_MODELS: LandingModel[] = [
  { emoji: "🐆", name: "Aurélie", handles: ["aurelie_.clochette", "aurelie_cutie"] },
  { emoji: "💎", name: "Anais", handles: ["anais.volt", "anaislaviolette_"] },
  { emoji: "🔥", name: "Alice", handles: ["alice.la.rousse", "alice.ton.bebe"] },
  { emoji: "🦋", name: "Lola", handles: ["la.belle.lolaa", "lola.hotesse"] },
];

export const LANDING_ACCOUNT_COUNT = LANDING_MODELS.reduce((n, m) => n + m.handles.length, 0);

export const LANDING_VAS = [
  {
    name: "🇷🇺 Alexandra",
    accounts: 4,
    handles: ["alice.la.rousse", "alice.ton.bebe", "anais.volt", "anaislaviolette_"] as const,
  },
  {
    name: "🐤 Callie",
    accounts: 4,
    handles: ["aurelie_.clochette", "aurelie_cutie", "la.belle.lolaa", "lola.hotesse"] as const,
  },
] as const;

export function modelForHandle(handle: string): LandingModel | undefined {
  return LANDING_MODELS.find((m) => m.handles.includes(handle));
}
