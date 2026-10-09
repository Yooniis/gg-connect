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

export type UnlockMetric = "scans" | "xp" | "none";

export type PuzzleStepType = "code" | "text" | "choice";

export type PuzzleChoice = {
  id: string;
  label: string;
  correct?: boolean;
};

export type PuzzleStep = {
  id: string;
  type: PuzzleStepType;
  prompt: string;
  /** Normalized correct answer for code/text */
  answer?: string;
  choices?: PuzzleChoice[];
  /** Optional: must scan this tag before answering this step */
  tagId?: string | null;
};

export type QuestGameMode = "custom" | "silence" | "builtin";

export type Quest = {
  id: number;
  sourceKey?: string | null;
  title: string;
  type: string;
  description: string;
  place: string;
  /** Human-readable step labels (legacy / display) */
  steps?: string;
  /** Structured puzzle steps as JSON string */
  puzzleSteps?: string;
  xp: number;
  hintCost: number;
  hintText: string;
  hintImageKey: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  /** NFC tag IDs required before puzzles / completion */
  tagIds?: string[];
  requireScan?: boolean;
  /** Per-quest unlock override; null = use community unlocks list or always open */
  unlockMetric?: UnlockMetric | null;
  unlockAt?: number | null;
  /** silence = MicGate; builtin = CoreQuestGames/QuestGames; custom = puzzle runner */
  gameMode?: QuestGameMode | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NfcTag = {
  id: string;
  name: string;
  stationKey: string;
  location: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CommunityUnlockRule = {
  questId: number;
  title: string;
  metric: UnlockMetric;
  at: number;
};

export type GameSettings = {
  simulateNfcEnabled: boolean;
  unlocks: CommunityUnlockRule[];
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

/** Default unlock ladder: 6–9 by scans, boss (4) by community XP */
export const DEFAULT_COMMUNITY_UNLOCKS: CommunityUnlockRule[] = [
  { at: 25, title: "Signalstafetten", questId: 6, metric: "scans" },
  { at: 75, title: "Minnesglitch", questId: 7, metric: "scans" },
  { at: 150, title: "Den falska noden", questId: 8, metric: "scans" },
  { at: 250, title: "Hemlig agent", questId: 9, metric: "scans" },
  { at: 15000, title: "Boss raid: Blackout", questId: 4, metric: "xp" },
];

/** @deprecated use DEFAULT_COMMUNITY_UNLOCKS — kept for gradual migration */
export const COMMUNITY_UNLOCKS = DEFAULT_COMMUNITY_UNLOCKS.map(
  ({ at, title, questId }) => ({ at, title, questId }),
);

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

export const DEFAULT_NFC_TAGS: Omit<NfcTag, "createdAt" | "updatedAt">[] = [
  { id: "tag-001", name: "Kapphängning", stationKey: "kapphangning", location: "Nedre foajé", active: true },
  { id: "tag-002", name: "Soffgrupp nedre", stationKey: "soffor-nedre", location: "Nedre foajé", active: true },
  { id: "tag-003", name: "Fejkad eldstad", stationKey: "eldstad", location: "Övre foajé", active: true },
  { id: "tag-004", name: "Övre ståbord", stationKey: "stabord-ovre", location: "Övre foajé", active: true },
  { id: "tag-005", name: "TV-spel under läktaren", stationKey: "tv-spel", location: "Skeppet", active: true },
  { id: "tag-006", name: "TV-hörna", stationKey: "tv-horna", location: "Skeppet", active: true },
  { id: "tag-007", name: "Sällskapsspel gradäng", stationKey: "sallskapsspel", location: "Skeppet", active: true },
  { id: "tag-008", name: "Scen publik sida", stationKey: "scen-publik", location: "Skeppet", active: true },
  { id: "tag-009", name: "Utomhus entré", stationKey: "utomhus-entre", location: "Utomhus", active: true },
  { id: "tag-010", name: "Vandrande ledartagg", stationKey: "ledare", location: "Rörlig", active: true },
];

export function nameKey(name: string) {
  return name.trim().toLocaleLowerCase("sv-SE");
}

export function compositeKey(name: string, suffix: string | number) {
  return `${nameKey(name)}_${suffix}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeAnswer(value: string) {
  return value.trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ");
}

export function parsePuzzleSteps(raw: string | PuzzleStep[] | null | undefined): PuzzleStep[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseStepLabels(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw ? [String(raw)] : [];
  }
}
