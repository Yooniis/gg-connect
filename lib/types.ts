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
  /** Short code on the physical sticker — required for manual check-in (anti-share). */
  accessCode: string;
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
  /** Bump to roll out new default unlock ladder without wiping custom admin edits forever */
  progressionVersion?: number;
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

/** Display name for the player currency (stored as `xp` in Firestore). */
export const CURRENCY = "Chip";

/**
 * Progression for ~40 spelare.
 * Max unika skanningar ≈ 40 × 10 noder = 400.
 * Boss via community-Chip så den kan låsas upp när som under kvällen.
 */
export const PROGRESSION_VERSION = 2;

export const DEFAULT_COMMUNITY_UNLOCKS: CommunityUnlockRule[] = [
  { at: 40, title: "Signalstafetten", questId: 6, metric: "scans" },
  { at: 90, title: "Minnesglitch", questId: 7, metric: "scans" },
  { at: 140, title: "Kodspegeln", questId: 11, metric: "scans" },
  { at: 200, title: "Den falska noden", questId: 8, metric: "scans" },
  { at: 12000, title: "Pixelchiffer", questId: 15, metric: "xp" },
  { at: 260, title: "Hemlig agent", questId: 9, metric: "scans" },
  { at: 20000, title: "Nodväxeln", questId: 13, metric: "xp" },
  { at: 32000, title: "Boss raid: Blackout", questId: 4, metric: "xp" },
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
  11: { xp: 340, target: 480 },
  12: { xp: 280, target: 420 },
  13: { xp: 640, target: 900 },
  14: { xp: 400, target: 600 },
  15: { xp: 380, target: 540 },
};

const ACCESS_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Stable sticker code derived from stationKey (so reprints stay consistent). */
export function accessCodeForStation(stationKey: string) {
  let h = 2166136261;
  for (let i = 0; i < stationKey.length; i++) {
    h ^= stationKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  let x = h >>> 0;
  for (let i = 0; i < 4; i++) {
    out += ACCESS_ALPHABET[x % ACCESS_ALPHABET.length];
    x = Math.floor(x / ACCESS_ALPHABET.length) + 17;
  }
  return out;
}

export function normalizeAccessCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const DEFAULT_NFC_TAGS: Omit<NfcTag, "createdAt" | "updatedAt">[] = [
  { id: "tag-001", name: "Kapphängning", stationKey: "kapphangning", location: "Nedre foajé", accessCode: accessCodeForStation("kapphangning"), active: true },
  { id: "tag-002", name: "Soffgrupp nedre", stationKey: "soffor-nedre", location: "Nedre foajé", accessCode: accessCodeForStation("soffor-nedre"), active: true },
  { id: "tag-003", name: "Fejkad eldstad", stationKey: "eldstad", location: "Övre foajé", accessCode: accessCodeForStation("eldstad"), active: true },
  { id: "tag-004", name: "Övre ståbord", stationKey: "stabord-ovre", location: "Övre foajé", accessCode: accessCodeForStation("stabord-ovre"), active: true },
  { id: "tag-005", name: "TV-spel under läktaren", stationKey: "tv-spel", location: "Skeppet", accessCode: accessCodeForStation("tv-spel"), active: true },
  { id: "tag-006", name: "TV-hörna", stationKey: "tv-horna", location: "Skeppet", accessCode: accessCodeForStation("tv-horna"), active: true },
  { id: "tag-007", name: "Sällskapsspel gradäng", stationKey: "sallskapsspel", location: "Skeppet", accessCode: accessCodeForStation("sallskapsspel"), active: true },
  { id: "tag-008", name: "Scen publik sida", stationKey: "scen-publik", location: "Skeppet", accessCode: accessCodeForStation("scen-publik"), active: true },
  { id: "tag-009", name: "Utomhus entré", stationKey: "utomhus-entre", location: "Utomhus", accessCode: accessCodeForStation("utomhus-entre"), active: true },
  { id: "tag-010", name: "Vandrande ledartagg", stationKey: "ledare", location: "Rörlig", accessCode: accessCodeForStation("ledare"), active: true },
];

export function nfcScanUrl(origin: string, tag: Pick<NfcTag, "stationKey" | "accessCode">) {
  const base = origin.replace(/\/$/, "");
  return `${base}/scan?station=${encodeURIComponent(tag.stationKey)}&k=${encodeURIComponent(tag.accessCode)}`;
}

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

/** How many players must be in the lobby before a multiplayer quest can start. */
export const QUEST_PARTY_SIZE: Record<number, number> = {
  2: 3, // Synkronisera nätverket
  5: 2, // Tyst kommunikation
  6: 3, // Signalstafetten
  9: 2, // Hemlig agent
  13: 3, // Nodväxeln
};

export function partySizeForQuest(questId: number, type?: string | null) {
  if (QUEST_PARTY_SIZE[questId]) return QUEST_PARTY_SIZE[questId];
  if (String(type || "").toUpperCase() === "LAG") return 2;
  return 1;
}

export type QuestLobbyMember = {
  name: string;
  token: string;
  slot: number;
  ready: boolean;
  joinedAt: string;
};

export type QuestLobbyPending = {
  name: string;
  token: string;
  requestedAt: string;
};

export type QuestLobbyStatus = "open" | "forming" | "running" | "closed";

export type QuestLobby = {
  id: string;
  questId: number;
  questTitle: string;
  requiredPlayers: number;
  hostToken: string;
  hostName: string;
  status: QuestLobbyStatus;
  members: QuestLobbyMember[];
  /** Join requests waiting for host acceptance — not in the team yet */
  pending: QuestLobbyPending[];
  /** token -> assigned role/clue slot (set when running) */
  assignments: Record<string, number>;
  /** Shared node scans for sync-style quests (index = slot) */
  scans?: boolean[];
  /** Shared deadline for the 10-second sync window */
  windowEndsAt?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
};

/** Split clues for Tyst kommunikation — never show both to one player. Answer: BLÅ7 */
export const SILENCE_CLUES = [
  "FÄRGEN FINNS OVANFÖR MOLNEN",
  "TALET KOMMER EFTER SEX",
] as const;

export const SYNC_NODE_ROLES = [
  "Kapphängningen (nedre foajén)",
  "Fejkade eldstaden (övre foajén)",
  "TV-spelen under läktaren",
] as const;
