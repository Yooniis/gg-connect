export type Player = {
  name: string;
  team: string;
  xp: number;
  updatedAt?: string;
};

export type PlayerProfile = {
  token: string;
  name: string;
  nameLower: string;
  team: string;
  pinHash?: string | null;
  pinSalt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Quest = {
  id: number;
  sourceKey?: string | null;
  title: string;
  type: string;
  description: string;
  place: string;
  steps?: string;
  xp: number;
  hintCost: number;
  hintText: string;
  hintImageKey: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Activity = {
  id: number;
  playerName: string;
  kind: string;
  message: string;
  xp: number;
  createdAt: string;
};

export const COMMUNITY_UNLOCKS = [
  { at: 25, title: "Signalstafetten", questId: 6 },
  { at: 75, title: "Minnesglitch", questId: 7 },
  { at: 150, title: "Den falska noden", questId: 8 },
  { at: 250, title: "Hemlig agent", questId: 9 },
  { at: 400, title: "Boss raid: Blackout", questId: 4 },
] as const;

export const BUILTIN_QUEST_REWARDS: Record<number, { xp: number; target: number }> = {
  1: { xp: 250, target: 600 },
  2: { xp: 600, target: 720 },
  3: { xp: 180, target: 420 },
  4: { xp: 1200, target: 1200 },
  5: { xp: 450, target: 600 },
  6: { xp: 520, target: 720 },
  7: { xp: 300, target: 300 },
  8: { xp: 360, target: 480 },
  9: { xp: 480, target: 720 },
  10: { xp: 800, target: 1800 },
};

export function nameKey(name: string) {
  return name.trim().toLocaleLowerCase("sv-SE");
}

export function compositeKey(name: string, suffix: string | number) {
  return `${nameKey(name)}_${suffix}`;
}

export function nowIso() {
  return new Date().toISOString();
}
