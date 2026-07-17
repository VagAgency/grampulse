/** Données démo landing — comptes fictifs (ne pas utiliser de vrais @handles clients) */

export type LandingModel = {
  emoji: string;
  name: string;
  handles: string[];
};

export const LANDING_MODELS: LandingModel[] = [
  { emoji: "🐆", name: "Camille", handles: ["camille.daily", "camille.privee"] },
  { emoji: "💎", name: "Jade", handles: ["jade.officiel", "jade.stories"] },
  { emoji: "🔥", name: "Mila", handles: ["mila.paris", "mila.afterdark"] },
  { emoji: "🦋", name: "Sasha", handles: ["sasha.mode", "sasha.club"] },
];

export const LANDING_ACCOUNT_COUNT = LANDING_MODELS.reduce((n, m) => n + m.handles.length, 0);

export const LANDING_VAS = [
  {
    name: "🇷🇺 Alexandra",
    accounts: 4,
    handles: ["mila.paris", "mila.afterdark", "jade.officiel", "jade.stories"] as const,
  },
  {
    name: "🐤 Callie",
    accounts: 4,
    handles: ["camille.daily", "camille.privee", "sasha.mode", "sasha.club"] as const,
  },
] as const;

export function modelForHandle(handle: string): LandingModel | undefined {
  return LANDING_MODELS.find((m) => m.handles.includes(handle));
}
