import { getAdminDb, getStorageBucket } from "./firebase-admin";
import {
  Activity,
  BUILTIN_QUEST_REWARDS,
  CommunityUnlockRule,
  DEFAULT_COMMUNITY_UNLOCKS,
  DEFAULT_NFC_TAGS,
  GameSettings,
  NfcTag,
  Player,
  PlayerProfile,
  PuzzleStep,
  Quest,
  UnlockMetric,
  compositeKey,
  nameKey,
  normalizeAnswer,
  nowIso,
  parsePuzzleSteps,
} from "./types";

const DEFAULT_QUESTS = [
  ["builtin-1", "Den försvunna signalen", "SOLO", "Vandrande ledare", 250, "Signalbrickan sitter på en ledare och vandrar mellan personer under kvällen. Tolka den aktuella ledtråden, hitta rätt bärare och skanna innan signalen lämnas vidare.", ["Läs ledtråden om signalbäraren", "Hitta ledaren i en tillåten publik zon", "Skanna den vandrande NFC-taggen och knäck koden"]],
  ["builtin-2", "Synkronisera nätverket", "LAG", "Tre offentliga zoner", 600, "Tre spelare delar upp sig mellan kapphängningen i nedre foajén, den fejkade eldstaden i övre foajén och TV-spelsstationerna under läktaren.", ["Samla ett lag på tre", "Ta varsin tilldelad publik zon", "Skanna de tre noderna inom 10 sekunder"]],
  ["builtin-3", "Pixeljägaren", "SOLO", "Utomhus → nedre foajén", 180, "Börja vid byggnadens entré utomhus, hitta pixelsymbolen längs fasaden och följ den vidare till soffgruppen i nedre foajén.", ["Hitta pixelsymbolen nära byggnaden", "Skanna utomhusnoden", "Lös pixelvägen vid soffgruppen i nedre foajén"]],
  ["builtin-4", "Boss raid: Blackout", "EVENT", "Skeppet", 1200, "Kvällens raid utspelas i Skeppet. Energicellerna finns vid gradängens sällskapsspel, TV-hörnan och scenens publika sida – aldrig vid teknikbordet.", ["Samlas i Skeppet utan att blockera entréerna", "Aktivera tre säkra energiceller", "Kombinera slutkoden tillsammans"]],
  ["builtin-5", "Tyst kommunikation", "LAG", "Övre foajéns hängyta", 450, "Sätt er vid sofforna nära den fejkade eldstaden. Ni får varsin del av en gåta och måste skriva in lösningen utan att prata.", ["Samlas vid övre foajéns soffor", "Starta mikrofonkontrollen innan ledtråden visas", "Kombinera ledtrådarna tyst och skriv rätt svar"]],
  ["builtin-6", "Signalstafetten", "LAG", "Nedre foajé → Skeppet", 520, "För signalen från soffgruppen i nedre foajén, via den fejkade eldstaden på övervåningen, till sällskapsspelen vid gradängen i Skeppet.", ["Starta vid nedre foajéns soffgrupp", "Aktivera eldstadsnoden i övre foajén", "Avsluta vid gradängens sällskapsspel"]],
  ["builtin-7", "Minnesglitch", "SOLO", "TV-spel under läktaren", 300, "Skanna minnesnoden vid TV-spelsstationerna under läktaren. Memorera färgsekvensen och återskapa den i mobilen.", ["Hitta minnesnoden under läktaren", "Memorera färgernas ordning", "Återskapa sekvensen utan en ny titt"]],
  ["builtin-8", "Den falska noden", "SOLO", "Tre publika platser", 360, "Samla påståenden vid kapphängningen, övre foajéns ståbord och TV-hörnan bredvid scenen. En nod ljuger.", ["Skanna de tre publika noderna", "Jämför deras påståenden", "Peka ut den falska noden"]],
  ["builtin-9", "Hemlig agent", "LAG", "Ledarbärare → TV-hörnan", 480, "En spelare får ett dolt uppdrag från den vandrande ledartaggen och ska styra laget mot TV-hörnan utan att avslöja sin roll.", ["Hitta en ledare med den vandrande taggen", "Öppna din hemliga roll diskret", "Slutför uppdraget vid TV-hörnan"]],
  ["builtin-10", "Community unlock", "EVENT", "Alla publika zoner", 800, "Unika skanningar utomhus, i båda foajéerna och i Skeppet laddar LAN-kärnan. Förbjudna och privata rum används aldrig.", ["Hitta en aktiv nod i en publik zon", "Registrera en unik skanning", "Hjälp hela LAN:et låsa upp bonusuppdraget"]],
] as const;

function db() {
  return getAdminDb();
}

async function nextCounter(name: string, startAt = 1) {
  const ref = db().collection("counters").doc(name);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = Number(snap.data()?.value || startAt - 1) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return next;
  });
}

function questFromDoc(id: number, data: Record<string, unknown>): Quest {
  const tagIds = Array.isArray(data.tagIds)
    ? data.tagIds.map(String)
    : typeof data.tagIds === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(data.tagIds);
            return Array.isArray(parsed) ? parsed.map(String) : [];
          } catch {
            return [];
          }
        })()
      : [];
  return {
    id,
    sourceKey: (data.sourceKey as string | null | undefined) ?? null,
    title: String(data.title || ""),
    type: String(data.type || "SOLO"),
    description: String(data.description || ""),
    place: String(data.place || ""),
    steps: String(data.steps || "[]"),
    puzzleSteps: String(data.puzzleSteps || "[]"),
    xp: Number(data.xp || 0),
    hintCost: Number(data.hintCost || 0),
    hintText: String(data.hintText || ""),
    hintImageKey: (data.hintImageKey as string | null | undefined) ?? null,
    startsAt: (data.startsAt as string | null | undefined) ?? null,
    endsAt: (data.endsAt as string | null | undefined) ?? null,
    status: String(data.status || "draft"),
    tagIds,
    requireScan: data.requireScan !== false,
    unlockMetric: (data.unlockMetric as UnlockMetric | null | undefined) ?? null,
    unlockAt: data.unlockAt == null ? null : Number(data.unlockAt),
    gameMode: (data.gameMode as Quest["gameMode"]) ?? (id === 5 ? "silence" : id <= 10 ? "builtin" : "custom"),
    createdBy: data.createdBy as string | undefined,
    createdAt: data.createdAt as string | undefined,
    updatedAt: data.updatedAt as string | undefined,
  };
}

function tagFromDoc(id: string, data: Record<string, unknown>): NfcTag {
  return {
    id,
    name: String(data.name || ""),
    stationKey: String(data.stationKey || id),
    location: String(data.location || ""),
    active: data.active !== false,
    createdAt: data.createdAt as string | undefined,
    updatedAt: data.updatedAt as string | undefined,
  };
}

const QUEST_SEED_META: Record<
  number,
  { tagIds: string[]; gameMode: Quest["gameMode"]; puzzleSteps: PuzzleStep[] }
> = {
  1: {
    tagIds: ["tag-010"],
    gameMode: "builtin",
    puzzleSteps: [],
  },
  2: {
    tagIds: ["tag-001", "tag-003", "tag-005"],
    gameMode: "builtin",
    puzzleSteps: [],
  },
  3: {
    tagIds: ["tag-009", "tag-002"],
    gameMode: "builtin",
    puzzleSteps: [],
  },
  4: {
    tagIds: ["tag-007", "tag-006", "tag-008"],
    gameMode: "builtin",
    puzzleSteps: [],
  },
  5: {
    tagIds: ["tag-003"],
    gameMode: "silence",
    puzzleSteps: [],
  },
  6: {
    tagIds: ["tag-002", "tag-003", "tag-007"],
    gameMode: "custom",
    puzzleSteps: [
      {
        id: "s1",
        type: "code",
        prompt: "Ange stationskoden från soffgruppen (står på brickan).",
        answer: "a7",
        tagId: "tag-002",
      },
      {
        id: "s2",
        type: "code",
        prompt: "Ange koden från eldstadsnoden.",
        answer: "k2",
        tagId: "tag-003",
      },
      {
        id: "s3",
        type: "code",
        prompt: "Ange slutkoden vid sällskapsspelen.",
        answer: "x9",
        tagId: "tag-007",
      },
    ],
  },
  7: {
    tagIds: ["tag-005"],
    gameMode: "custom",
    puzzleSteps: [
      {
        id: "s1",
        type: "choice",
        prompt: "Vilken färgsekvens visades på minnesnoden?",
        tagId: "tag-005",
        choices: [
          { id: "a", label: "Orange → Röd → Gul → Blå", correct: true },
          { id: "b", label: "Blå → Gul → Röd → Orange", correct: false },
          { id: "c", label: "Röd → Orange → Blå → Gul", correct: false },
        ],
      },
    ],
  },
  8: {
    tagIds: ["tag-001", "tag-004", "tag-006"],
    gameMode: "custom",
    puzzleSteps: [
      {
        id: "s1",
        type: "choice",
        prompt: "Två noder talar sanning. Vilken ljuger?",
        choices: [
          { id: "a", label: "NOD A – ”Koden är ett jämnt tal.”", correct: false },
          { id: "b", label: "NOD B – ”Koden är större än 8.”", correct: true },
          { id: "c", label: "NOD C – ”Koden är 6.”", correct: false },
        ],
      },
    ],
  },
  9: {
    tagIds: ["tag-010", "tag-006"],
    gameMode: "custom",
    puzzleSteps: [
      {
        id: "s1",
        type: "text",
        prompt: "Efter ledartaggen: vilket kodord fick du? (THE GLITCH)",
        answer: "the glitch",
        tagId: "tag-010",
      },
      {
        id: "s2",
        type: "code",
        prompt: "Bekräfta slutnoden vid TV-hörnan med koden.",
        answer: "agent",
        tagId: "tag-006",
      },
    ],
  },
  10: {
    tagIds: [],
    gameMode: "custom",
    puzzleSteps: [],
  },
};

export async function ensureDefaults() {
  const community = db().collection("communityState").doc("default");
  const communitySnap = await community.get();
  if (!communitySnap.exists) {
    await community.set({ scans: 0, totalXp: 0, goal: 500, updatedAt: nowIso() });
  }

  const settingsRef = db().collection("gameSettings").doc("default");
  const settingsSnap = await settingsRef.get();
  if (!settingsSnap.exists) {
    await settingsRef.set({
      simulateNfcEnabled: true,
      unlocks: DEFAULT_COMMUNITY_UNLOCKS,
      updatedAt: nowIso(),
    } satisfies GameSettings);
  }

  const tagBatch = db().batch();
  let tagWrites = 0;
  for (const tag of DEFAULT_NFC_TAGS) {
    const ref = db().collection("nfcTags").doc(tag.id);
    const snap = await ref.get();
    if (!snap.exists) {
      tagBatch.set(ref, { ...tag, createdAt: nowIso(), updatedAt: nowIso() });
      tagWrites++;
    }
  }
  if (tagWrites) await tagBatch.commit();

  const batch = db().batch();
  let writes = 0;
  for (let i = 0; i < DEFAULT_QUESTS.length; i++) {
    const [sourceKey, title, type, place, xp, description, steps] = DEFAULT_QUESTS[i];
    const id = i + 1;
    const meta = QUEST_SEED_META[id];
    const ref = db().collection("quests").doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) {
      batch.set(ref, {
        sourceKey,
        title,
        type,
        place,
        xp,
        description,
        steps: JSON.stringify(steps),
        puzzleSteps: JSON.stringify(meta?.puzzleSteps || []),
        tagIds: meta?.tagIds || [],
        requireScan: (meta?.tagIds?.length || 0) > 0,
        gameMode: meta?.gameMode || "builtin",
        unlockMetric: null,
        unlockAt: null,
        status: "published",
        createdBy: "system@goodgame",
        hintCost: 100,
        hintText: "",
        hintImageKey: null,
        startsAt: null,
        endsAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      writes++;
    } else {
      const data = snap.data() || {};
      const patch: Record<string, unknown> = {};
      if (!Array.isArray(data.tagIds) && meta?.tagIds) patch.tagIds = meta.tagIds;
      if (data.puzzleSteps == null && meta) patch.puzzleSteps = JSON.stringify(meta.puzzleSteps);
      if (data.gameMode == null && meta) patch.gameMode = meta.gameMode;
      if (data.requireScan == null) patch.requireScan = (meta?.tagIds?.length || 0) > 0;
      if (Object.keys(patch).length) {
        patch.updatedAt = nowIso();
        batch.set(ref, patch, { merge: true });
        writes++;
      }
    }
  }
  if (writes) await batch.commit();

  const counter = db().collection("counters").doc("quests");
  const counterSnap = await counter.get();
  if (!counterSnap.exists) await counter.set({ value: 100 });
}

export async function getGameSettings(): Promise<GameSettings> {
  await ensureDefaults();
  const snap = await db().collection("gameSettings").doc("default").get();
  const data = snap.data() || {};
  const unlocks = Array.isArray(data.unlocks) && data.unlocks.length
    ? (data.unlocks as CommunityUnlockRule[]).map((u) => ({
        questId: Number(u.questId),
        title: String(u.title || ""),
        metric: (u.metric === "xp" || u.metric === "none" ? u.metric : "scans") as UnlockMetric,
        at: Number(u.at || 0),
      }))
    : DEFAULT_COMMUNITY_UNLOCKS;
  return {
    simulateNfcEnabled: data.simulateNfcEnabled !== false,
    unlocks,
    updatedAt: data.updatedAt as string | undefined,
  };
}

export async function updateGameSettings(changes: Partial<GameSettings>) {
  const current = await getGameSettings();
  const next: GameSettings = {
    simulateNfcEnabled:
      changes.simulateNfcEnabled !== undefined
        ? Boolean(changes.simulateNfcEnabled)
        : current.simulateNfcEnabled,
    unlocks: changes.unlocks ?? current.unlocks,
    updatedAt: nowIso(),
  };
  await db().collection("gameSettings").doc("default").set(next, { merge: true });
  return next;
}

export async function listTags(): Promise<NfcTag[]> {
  await ensureDefaults();
  const snaps = await db().collection("nfcTags").limit(200).get();
  return snaps.docs
    .map((d) => tagFromDoc(d.id, d.data()))
    .sort((a, b) => a.id.localeCompare(b.id, "sv"));
}

export async function getTag(id: string) {
  const snap = await db().collection("nfcTags").doc(id).get();
  if (!snap.exists) return null;
  return tagFromDoc(id, snap.data()!);
}

export async function getTagByStationKey(stationKey: string) {
  const key = stationKey.trim().toLocaleLowerCase("sv-SE");
  const snaps = await db().collection("nfcTags").where("stationKey", "==", stationKey).limit(1).get();
  if (!snaps.empty) return tagFromDoc(snaps.docs[0].id, snaps.docs[0].data());
  const all = await listTags();
  return all.find((t) => t.stationKey.toLocaleLowerCase("sv-SE") === key) || null;
}

export async function createTag(input: {
  name: string;
  stationKey: string;
  location?: string;
  active?: boolean;
}) {
  const idNum = await nextCounter("nfcTags", 100);
  const id = `tag-${String(idNum).padStart(3, "0")}`;
  const stamp = nowIso();
  const tag: NfcTag = {
    id,
    name: input.name.trim(),
    stationKey: input.stationKey.trim().slice(0, 80) || id,
    location: (input.location || "").trim(),
    active: input.active !== false,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db().collection("nfcTags").doc(id).set(tag);
  return tag;
}

export async function updateTag(id: string, changes: Partial<NfcTag>) {
  const ref = db().collection("nfcTags").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const patch: Record<string, unknown> = { updatedAt: nowIso() };
  if (changes.name !== undefined) patch.name = String(changes.name).trim();
  if (changes.stationKey !== undefined) patch.stationKey = String(changes.stationKey).trim().slice(0, 80);
  if (changes.location !== undefined) patch.location = String(changes.location).trim();
  if (changes.active !== undefined) patch.active = Boolean(changes.active);
  await ref.set(patch, { merge: true });
  return getTag(id);
}

export async function deleteTag(id: string) {
  await db().collection("nfcTags").doc(id).delete();
}

export async function communityTotalXp() {
  const snaps = await db().collection("players").select("xp").limit(5000).get();
  return snaps.docs.reduce((sum, d) => sum + Number(d.data().xp || 0), 0);
}

export function scheduleGate(quest: Quest, now = Date.now()) {
  if (quest.startsAt) {
    const start = new Date(quest.startsAt).getTime();
    if (!Number.isNaN(start) && now < start) {
      return {
        ok: false as const,
        error: `Uppdraget öppnar ${new Date(quest.startsAt).toLocaleString("sv-SE")}.`,
        status: 403 as const,
      };
    }
  }
  if (quest.endsAt) {
    const end = new Date(quest.endsAt).getTime();
    if (!Number.isNaN(end) && now > end) {
      return {
        ok: false as const,
        error: `Uppdraget stängde ${new Date(quest.endsAt).toLocaleString("sv-SE")}.`,
        status: 403 as const,
      };
    }
  }
  return { ok: true as const };
}

export function unlockProgress(
  rule: CommunityUnlockRule,
  scans: number,
  totalXp: number,
) {
  if (rule.metric === "none") return { unlocked: true, current: 0, at: 0 };
  if (rule.metric === "xp") {
    return { unlocked: totalXp >= rule.at, current: totalXp, at: rule.at };
  }
  return { unlocked: scans >= rule.at, current: scans, at: rule.at };
}

export async function isQuestUnlocked(
  quest: Quest,
  scans: number,
  totalXp: number,
  unlocks: CommunityUnlockRule[],
) {
  if (quest.unlockMetric === "none") return true;
  if (quest.unlockMetric === "scans" || quest.unlockMetric === "xp") {
    const at = Number(quest.unlockAt || 0);
    if (quest.unlockMetric === "xp") return totalXp >= at;
    return scans >= at;
  }
  const rule = unlocks.find((u) => u.questId === quest.id);
  if (!rule || rule.metric === "none") return true;
  return unlockProgress(rule, scans, totalXp).unlocked;
}

export async function getProfileByToken(token: string): Promise<PlayerProfile | null> {
  if (!token) return null;
  const snap = await db().collection("playerProfiles").doc(token).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return {
    token,
    name: data.name,
    nameLower: data.nameLower || nameKey(data.name),
    team: data.team || "Solo",
    pinHash: data.pinHash ?? null,
    pinSalt: data.pinSalt ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function getProfileByName(name: string): Promise<PlayerProfile | null> {
  const q = await db()
    .collection("playerProfiles")
    .where("nameLower", "==", nameKey(name))
    .limit(1)
    .get();
  if (q.empty) return null;
  const doc = q.docs[0];
  const data = doc.data();
  return {
    token: doc.id,
    name: data.name,
    nameLower: data.nameLower || nameKey(data.name),
    team: data.team || "Solo",
    pinHash: data.pinHash ?? null,
    pinSalt: data.pinSalt ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function getPlayer(name: string): Promise<Player | null> {
  const snap = await db().collection("players").doc(nameKey(name)).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return {
    name: data.name,
    team: data.team || "Solo",
    xp: Number(data.xp || 0),
    updatedAt: data.updatedAt,
  };
}

export async function playerCookieToken(request: Request) {
  return decodeURIComponent(
    (request.headers.get("cookie") || "").match(/(?:^|; )gg_player=([^;]+)/)?.[1] || "",
  );
}

export async function sessionFromRequest(request: Request, fallback = "") {
  const token = await playerCookieToken(request);
  if (!token) return { name: fallback, team: "Solo", token: "" };
  const profile = await getProfileByToken(token);
  return {
    name: profile?.name || fallback,
    team: profile?.team || "Solo",
    token,
  };
}

export async function upsertPlayerProfile(input: {
  token: string;
  name: string;
  team: string;
  pinHash?: string | null;
  pinSalt?: string | null;
  isNew: boolean;
}) {
  const { token, name, team, pinHash, pinSalt, isNew } = input;
  const key = nameKey(name);
  const conflict = await db()
    .collection("playerProfiles")
    .where("nameLower", "==", key)
    .limit(1)
    .get();
  if (!conflict.empty && conflict.docs[0].id !== token) {
    return { ok: false as const, error: "Det spelarnamnet är redan upptaget.", status: 409 as const };
  }

  const previous = await getProfileByToken(token);
  if (previous && previous.name !== name) {
    const occupied = await getPlayer(name);
    if (occupied) {
      return { ok: false as const, error: "Det spelarnamnet är redan upptaget.", status: 409 as const };
    }
    await renamePlayer(previous.name, name, team);
  }

  const profileRef = db().collection("playerProfiles").doc(token);
  const playerRef = db().collection("players").doc(key);
  const stamp = nowIso();

  if (isNew) {
    await profileRef.set({
      name,
      nameLower: key,
      team,
      pinHash: pinHash || null,
      pinSalt: pinSalt || null,
      createdAt: stamp,
      updatedAt: stamp,
    });
    const existingPlayer = await playerRef.get();
    if (existingPlayer.exists && !previous) {
      await playerRef.set({ name, team, xp: 0, updatedAt: stamp }, { merge: true });
    } else {
      await playerRef.set({ name, team, xp: Number(existingPlayer.data()?.xp || 0), updatedAt: stamp }, { merge: true });
    }
  } else {
    await profileRef.set(
      { name, nameLower: key, team, updatedAt: stamp },
      { merge: true },
    );
    await playerRef.set({ name, team, updatedAt: stamp }, { merge: true });
  }

  return { ok: true as const, player: { name, team, token } };
}

async function renamePlayer(oldName: string, newName: string, team: string) {
  const oldKey = nameKey(oldName);
  const newKey = nameKey(newName);
  const stamp = nowIso();
  const oldPlayer = await db().collection("players").doc(oldKey).get();
  const xp = Number(oldPlayer.data()?.xp || 0);

  const batch = db().batch();
  batch.set(db().collection("players").doc(newKey), {
    name: newName,
    team,
    xp,
    updatedAt: stamp,
  });
  batch.delete(db().collection("players").doc(oldKey));

  for (const col of ["questCompletions", "questAcceptances", "hintPurchases", "nfcScans", "questTagScans"] as const) {
    const snaps = await db().collection(col).where("playerName", "==", oldName).get();
    for (const doc of snaps.docs) {
      const data = doc.data();
      const suffix =
        col === "nfcScans"
          ? data.stationKey
          : col === "questTagScans"
            ? `${data.questId}_${data.tagId}`
            : data.questId;
      const nextId = compositeKey(newName, suffix);
      batch.set(db().collection(col).doc(nextId), {
        ...data,
        playerName: newName,
        playerNameLower: newKey,
      });
      batch.delete(doc.ref);
    }
  }

  const activities = await db().collection("activityFeed").where("playerName", "==", oldName).get();
  for (const doc of activities.docs) {
    batch.update(doc.ref, { playerName: newName });
  }

  await batch.commit();
}

export async function setProfilePin(token: string, pinHash: string, pinSalt: string) {
  await db().collection("playerProfiles").doc(token).set(
    { pinHash, pinSalt, updatedAt: nowIso() },
    { merge: true },
  );
}

export async function updateTeam(token: string, team: string) {
  const profile = await getProfileByToken(token);
  if (!profile) return null;
  const stamp = nowIso();
  await db().collection("playerProfiles").doc(token).set({ team, updatedAt: stamp }, { merge: true });
  await db().collection("players").doc(nameKey(profile.name)).set(
    { team, updatedAt: stamp },
    { merge: true },
  );
  return { name: profile.name, team, token };
}

export async function findCanonicalTeam(requested: string) {
  if (requested === "Solo") return "Solo";
  const snaps = await db().collection("playerProfiles").where("team", "!=", "Solo").limit(200).get();
  const match = snaps.docs.find(
    (d) => String(d.data().team || "").toLocaleLowerCase("sv-SE") === requested.toLocaleLowerCase("sv-SE"),
  );
  return match?.data().team || requested;
}

export async function listTeams(query: string) {
  const snaps = await db().collection("playerProfiles").limit(500).get();
  const players = await db().collection("players").limit(500).get();
  const xpByName = new Map(
    players.docs.map((d) => [nameKey(d.data().name || d.id), Number(d.data().xp || 0)]),
  );
  const map = new Map<string, { name: string; members: number; xp: number }>();
  for (const doc of snaps.docs) {
    const team = String(doc.data().team || "Solo");
    if (team === "Solo") continue;
    if (query && !team.toLocaleLowerCase("sv-SE").includes(query.toLocaleLowerCase("sv-SE"))) continue;
    const key = team.toLocaleLowerCase("sv-SE");
    const prev = map.get(key) || { name: team, members: 0, xp: 0 };
    prev.members += 1;
    prev.xp += xpByName.get(nameKey(doc.data().name)) || 0;
    map.set(key, prev);
  }
  return [...map.values()]
    .sort((a, b) => b.members - a.members || b.xp - a.xp || a.name.localeCompare(b.name, "sv"))
    .slice(0, 12);
}

export async function teamMembers(team: string) {
  const snaps = await db().collection("playerProfiles").where("team", "==", team).limit(100).get();
  const out = [];
  for (const doc of snaps.docs) {
    const name = doc.data().name as string;
    const player = await getPlayer(name);
    out.push({
      name,
      team,
      xp: player?.xp || 0,
      updatedAt: player?.updatedAt || doc.data().updatedAt,
    });
  }
  return out.sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name, "sv"));
}

async function addActivity(playerName: string, kind: string, message: string, xp: number) {
  const id = await nextCounter("activityFeed", 1);
  const createdAt = nowIso();
  await db().collection("activityFeed").doc(String(id)).set({
    id,
    playerName,
    kind,
    message,
    xp,
    createdAt,
  });
  return { id, playerName, kind, message, xp, createdAt } satisfies Activity;
}

export async function progressSnapshot(name: string) {
  const player = await getPlayer(name);
  const completions = await db()
    .collection("questCompletions")
    .where("playerName", "==", name)
    .limit(100)
    .get();
  const acceptances = await db()
    .collection("questAcceptances")
    .where("playerName", "==", name)
    .limit(100)
    .get();
  return {
    player,
    completions: completions.docs
      .map((d) => ({
        questId: d.data().questId,
        questTitle: d.data().questTitle,
        xpAwarded: d.data().xpAwarded,
        completedAt: d.data().completedAt,
      }))
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))),
    acceptances: acceptances.docs
      .map((d) => ({
        questId: d.data().questId,
        acceptedAt: d.data().acceptedAt,
      }))
      .sort((a, b) => String(b.acceptedAt).localeCompare(String(a.acceptedAt))),
  };
}

export async function acceptQuest(name: string, questId: number) {
  const quest = await getQuest(questId);
  if (!quest || quest.status !== "published") {
    return { ok: false as const, error: "Uppdraget finns inte eller är inte publicerat.", status: 404 as const };
  }
  const schedule = scheduleGate(quest);
  if (!schedule.ok) return schedule;

  const settings = await getGameSettings();
  const community = await db().collection("communityState").doc("default").get();
  const scans = Number(community.data()?.scans || 0);
  const totalXp = await communityTotalXp();
  const unlocked = await isQuestUnlocked(quest, scans, totalXp, settings.unlocks);
  if (!unlocked) {
    return { ok: false as const, error: "Uppdraget är fortfarande låst för communityn.", status: 403 as const };
  }

  const ref = db().collection("questAcceptances").doc(compositeKey(name, questId));
  let startedNow = false;
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return;
    startedNow = true;
    tx.set(ref, {
      playerName: name,
      playerNameLower: nameKey(name),
      questId,
      acceptedAt: nowIso(),
    });
  });
  const acceptance = (await ref.get()).data();
  return {
    ok: true as const,
    startedNow,
    acceptance: acceptance ? { acceptedAt: acceptance.acceptedAt } : null,
  };
}

export async function playerQuestTagScans(name: string, questId: number, tagIds?: string[]) {
  const ids =
    tagIds ||
    (await getQuest(questId))?.tagIds ||
    [];
  const out: { tagId: string; stationKey: string; scannedAt: string }[] = [];
  for (const tagId of ids) {
    const snap = await db()
      .collection("questTagScans")
      .doc(compositeKey(name, `${questId}_${tagId}`))
      .get();
    if (!snap.exists) continue;
    const data = snap.data()!;
    out.push({
      tagId: String(data.tagId || tagId),
      stationKey: String(data.stationKey || ""),
      scannedAt: String(data.scannedAt || ""),
    });
  }
  return out;
}

export async function recordQuestTagScan(input: {
  name: string;
  questId: number;
  tagId: string;
  stationKey: string;
}) {
  const { name, questId, tagId, stationKey } = input;
  const id = compositeKey(name, `${questId}_${tagId}`);
  const ref = db().collection("questTagScans").doc(id);
  let scannedNow = false;
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return;
    scannedNow = true;
    tx.set(ref, {
      playerName: name,
      playerNameLower: nameKey(name),
      questId,
      tagId,
      stationKey,
      scannedAt: nowIso(),
    });
  });
  return { scannedNow, scans: await playerQuestTagScans(name, questId) };
}

export function validatePuzzleAnswers(steps: PuzzleStep[], answers: { stepId: string; answer: string }[]) {
  if (!steps.length) return { ok: true as const };
  const map = new Map(answers.map((a) => [a.stepId, a.answer]));
  for (const step of steps) {
    const given = map.get(step.id);
    if (given == null || String(given).trim() === "") {
      return { ok: false as const, error: `Steg saknas: ${step.prompt.slice(0, 40)}` };
    }
    if (step.type === "choice") {
      const choice = (step.choices || []).find((c) => c.id === given || c.label === given);
      if (!choice?.correct) {
        return { ok: false as const, error: "Fel svar på flervalsfråga." };
      }
    } else {
      const expected = normalizeAnswer(step.answer || "");
      if (!expected || normalizeAnswer(given) !== expected) {
        return { ok: false as const, error: "Fel svar." };
      }
    }
  }
  return { ok: true as const };
}

export async function completeQuest(input: {
  name: string;
  team: string;
  questId: number;
  title: string;
  answers?: { stepId: string; answer: string }[];
  skipPuzzleCheck?: boolean;
}) {
  const { name, team, questId, title, answers = [], skipPuzzleCheck = false } = input;
  const quest = await getQuest(questId);
  if (!quest || quest.status !== "published") {
    return { ok: false as const, error: "Ogiltigt uppdrag", status: 400 as const };
  }

  const schedule = scheduleGate(quest);
  if (!schedule.ok) return schedule;

  let base = BUILTIN_QUEST_REWARDS[questId]?.xp || 0;
  let target = BUILTIN_QUEST_REWARDS[questId]?.target || 600;
  if (!base) {
    base = Math.max(0, Math.min(5000, Number(quest.xp) || 0));
    target = Math.max(300, Math.min(1800, Math.round(base * 1.5)));
  }
  if (!base) {
    return { ok: false as const, error: "Ogiltig Chip-belöning", status: 400 as const };
  }

  const acceptRef = db().collection("questAcceptances").doc(compositeKey(name, questId));
  const acceptSnap = await acceptRef.get();
  if (!acceptSnap.exists) {
    return {
      ok: false as const,
      error: "Uppdraget måste antas innan det kan slutföras.",
      status: 409 as const,
    };
  }

  const trustBuiltin =
    skipPuzzleCheck && (quest.gameMode === "builtin" || quest.gameMode === "silence");
  const requiredTags =
    !trustBuiltin && quest.requireScan !== false ? quest.tagIds || [] : [];
  if (requiredTags.length) {
    const scans = await playerQuestTagScans(name, questId, requiredTags);
    const scanned = new Set(scans.map((s) => s.tagId));
    const missing = requiredTags.filter((t) => !scanned.has(t));
    if (missing.length) {
      return {
        ok: false as const,
        error: `Skanna alla NFC-taggar först (${missing.length} kvar).`,
        status: 403 as const,
      };
    }
  }

  const puzzles = parsePuzzleSteps(quest.puzzleSteps);
  if (!skipPuzzleCheck && puzzles.length) {
    const check = validatePuzzleAnswers(puzzles, answers);
    if (!check.ok) {
      return { ok: false as const, error: check.error, status: 400 as const };
    }
  }

  const acceptedAt = String(acceptSnap.data()!.acceptedAt);
  const acceptedMs = new Date(acceptedAt).getTime();
  const elapsed = Math.max(1, Math.floor((Date.now() - acceptedMs) / 1000));
  const bonus = timeBonus(base, elapsed, target);
  const xp = base + bonus;

  const completionRef = db().collection("questCompletions").doc(compositeKey(name, questId));
  const playerRef = db().collection("players").doc(nameKey(name));
  const communityRef = db().collection("communityState").doc("default");
  let awarded = false;
  await db().runTransaction(async (tx) => {
    // Firestore requires all reads before any writes
    const existing = await tx.get(completionRef);
    const playerSnap = await tx.get(playerRef);
    const communitySnap = await tx.get(communityRef);
    if (existing.exists) return;
    awarded = true;
    const currentXp = Number(playerSnap.data()?.xp || 0);
    tx.set(completionRef, {
      playerName: name,
      playerNameLower: nameKey(name),
      questId,
      questTitle: title || quest.title,
      xpAwarded: xp,
      completedAt: nowIso(),
    });
    tx.set(
      playerRef,
      { name, team, xp: currentXp + xp, updatedAt: nowIso() },
      { merge: true },
    );
    tx.set(
      communityRef,
      {
        totalXp: Number(communitySnap.data()?.totalXp || 0) + xp,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
  });

  if (awarded) {
    await addActivity(name, "quest", `klarade ${title || quest.title} på ${formatTime(elapsed)}`, xp);
    await maybeEmitUnlocks();
  }

  return {
    ok: true as const,
    awarded,
    award: awarded ? { base, bonus, total: xp, elapsed, target } : null,
  };
}

async function maybeEmitUnlocks(opts?: { announce?: boolean }) {
  const announce = opts?.announce !== false;
  const settings = await getGameSettings();
  const community = await db().collection("communityState").doc("default").get();
  const scans = Number(community.data()?.scans || 0);
  const totalXp = await communityTotalXp();
  const rawEmitted = community.data()?.emittedUnlocks;
  const bootstrapped = community.data()?.unlocksBootstrapped === true;
  const emitted = new Set<string>((Array.isArray(rawEmitted) ? rawEmitted : []).map(String));
  const newly: string[] = [];
  for (const rule of settings.unlocks) {
    const key = `${rule.questId}:${rule.metric}:${rule.at}`;
    if (emitted.has(key)) continue;
    if (unlockProgress(rule, scans, totalXp).unlocked) {
      newly.push(key);
      // Skip historical unlocks on first bootstrap so live screen isn't flooded
      if (announce && bootstrapped) {
        await addActivity("COMMUNITY", "unlock", `låste upp ${rule.title}`, 0);
      }
    }
  }
  if (newly.length || !bootstrapped) {
    await db()
      .collection("communityState")
      .doc("default")
      .set(
        {
          emittedUnlocks: [...emitted, ...newly],
          unlocksBootstrapped: true,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
  }
}

function timeBonus(base: number, elapsed: number, target: number) {
  if (elapsed <= target * 0.5) return Math.round(base * 0.5);
  if (elapsed <= target) return Math.round(base * 0.3);
  if (elapsed <= target * 1.5) return Math.round(base * 0.15);
  return 0;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function communitySnapshot() {
  await ensureDefaults();
  // Ensure unlock bookkeeping exists without announcing historical unlocks
  const communityRef = db().collection("communityState").doc("default");
  const boot = await communityRef.get();
  if (!boot.data()?.unlocksBootstrapped) {
    await maybeEmitUnlocks({ announce: false });
  }
  const settings = await getGameSettings();
  const boardSnap = await db().collection("players").orderBy("xp", "desc").limit(10).get();
  const board = boardSnap.docs
    .map((d) => ({
      name: d.data().name as string,
      team: (d.data().team as string) || "Solo",
      xp: Number(d.data().xp || 0),
      updatedAt: d.data().updatedAt as string | undefined,
    }))
    .sort(
      (a, b) =>
        b.xp - a.xp ||
        String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")),
    );

  const baseSnap = await db().collection("communityState").doc("default").get();
  const scans = Number(baseSnap.data()?.scans || 0);
  const totalXp = await communityTotalXp();
  const goal = Number(baseSnap.data()?.goal || 500);
  const updatedAt = (baseSnap.data()?.updatedAt as string) || nowIso();

  const activitiesSnap = await db()
    .collection("activityFeed")
    .orderBy("id", "desc")
    .limit(8)
    .get();
  const activities = activitiesSnap.docs.map((d) => ({
    id: Number(d.data().id || d.id),
    playerName: d.data().playerName,
    kind: d.data().kind,
    message: d.data().message,
    xp: Number(d.data().xp || 0),
    createdAt: d.data().createdAt,
  }));

  const nfcSnap = await db().collection("nfcScans").select("playerName", "stationKey").limit(5000).get();
  const contributors = new Set(nfcSnap.docs.map((d) => d.data().playerName)).size;
  const nodes = new Set(nfcSnap.docs.map((d) => d.data().stationKey)).size;

  const unlocks = settings.unlocks.map((u) => {
    const progress = unlockProgress(u, scans, totalXp);
    return {
      ...u,
      unlocked: progress.unlocked,
      current: progress.current,
      unit: u.metric === "xp" ? "Chip" : u.metric === "scans" ? "skanningar" : "",
    };
  });
  const next = unlocks.find((u) => !u.unlocked) || null;
  const level = unlocks.filter((u) => u.unlocked).length + 1;

  return {
    board,
    settings: { simulateNfcEnabled: settings.simulateNfcEnabled },
    community: {
      scans,
      totalXp,
      goal,
      updatedAt,
      contributors,
      nodes,
      level,
      next,
      unlocks,
    },
    activities,
  };
}

export async function recordNfcScan(input: {
  name: string;
  team: string;
  stationKey: string;
  xpGain: number;
}) {
  const { name, team, stationKey, xpGain } = input;
  const scanRef = db().collection("nfcScans").doc(compositeKey(name, stationKey));
  const communityRef = db().collection("communityState").doc("default");
  let awarded = false;
  let before = 0;
  let after = 0;

  const playerRef = db().collection("players").doc(nameKey(name));
  await db().runTransaction(async (tx) => {
    const existing = await tx.get(scanRef);
    const community = await tx.get(communityRef);
    const playerSnap = await tx.get(playerRef);
    before = Number(community.data()?.scans || 0);
    if (existing.exists) {
      after = before;
      return;
    }
    awarded = true;
    after = before + 1;
    tx.set(scanRef, {
      playerName: name,
      playerNameLower: nameKey(name),
      stationKey,
      xpAwarded: xpGain,
      scannedAt: nowIso(),
    });
    tx.set(
      communityRef,
      { scans: after, goal: Number(community.data()?.goal || 500), updatedAt: nowIso() },
      { merge: true },
    );
    tx.set(
      playerRef,
      {
        name,
        team,
        xp: Number(playerSnap.data()?.xp || 0) + xpGain,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
  });

  if (awarded) {
    await addActivity(name, "scan", "hittade en NFC-signal", xpGain);
    await maybeEmitUnlocks();
  }

  // Also credit quest-tag progress when station matches a tag on an accepted quest
  const tag = await getTagByStationKey(stationKey);
  let questTagProgress: { questId: number; tagId: string } | null = null;
  if (tag) {
    const accepts = await db()
      .collection("questAcceptances")
      .where("playerName", "==", name)
      .limit(50)
      .get();
    for (const doc of accepts.docs) {
      const questId = Number(doc.data().questId);
      const quest = await getQuest(questId);
      if (!quest?.tagIds?.includes(tag.id)) continue;
      await recordQuestTagScan({
        name,
        questId,
        tagId: tag.id,
        stationKey: tag.stationKey,
      });
      questTagProgress = { questId, tagId: tag.id };
      break;
    }
  }

  return { scanAwarded: awarded, questTagProgress, before, after };
}

export async function hintStatus(name: string, questId: number) {
  const player = await getPlayer(name);
  const purchase = await db().collection("hintPurchases").doc(compositeKey(name, questId)).get();
  return { xp: player?.xp || 0, purchased: purchase.exists };
}

export async function purchaseHint(name: string, questId: number, cost: number) {
  const purchaseRef = db().collection("hintPurchases").doc(compositeKey(name, questId));
  const playerRef = db().collection("players").doc(nameKey(name));

  const existing = await purchaseRef.get();
  if (existing.exists) {
    const player = await getPlayer(name);
    return {
      ok: true as const,
      purchased: true,
      xp: player?.xp || 0,
      alreadyOwned: true as const,
    };
  }

  let newXp = 0;
  let purchasedNow = false;
  let error: string | null = null;

  await db().runTransaction(async (tx) => {
    const purchaseSnap = await tx.get(purchaseRef);
    const playerSnap = await tx.get(playerRef);
    const xp = Number(playerSnap.data()?.xp || 0);
    if (purchaseSnap.exists) {
      newXp = xp;
      return;
    }
    if (xp < cost) {
      error = "Du har inte tillräckligt med Chip.";
      return;
    }
    newXp = xp - cost;
    purchasedNow = true;
    tx.set(purchaseRef, {
      playerName: name,
      playerNameLower: nameKey(name),
      questId,
      cost,
      purchasedAt: nowIso(),
    });
    tx.set(playerRef, { name, xp: newXp, updatedAt: nowIso() }, { merge: true });
  });

  if (error) {
    return { ok: false as const, error, status: 409 as const };
  }
  if (purchasedNow) await addActivity(name, "hint", "köpte en ledtråd", -cost);
  const player = await getPlayer(name);
  return {
    ok: true as const,
    purchased: true,
    xp: player?.xp || newXp,
    alreadyOwned: !purchasedNow,
  };
}

export async function listPublishedCustomQuests() {
  await ensureDefaults();
  const snaps = await db().collection("quests").where("status", "==", "published").limit(200).get();
  return snaps.docs
    .map((d) => questFromDoc(Number(d.id), d.data()))
    .filter((q) => !q.sourceKey)
    .sort((a, b) => String(a.startsAt || "").localeCompare(String(b.startsAt || "")));
}

export async function listPublishedQuests() {
  await ensureDefaults();
  const snaps = await db().collection("quests").where("status", "==", "published").limit(200).get();
  return snaps.docs
    .map((d) => questFromDoc(Number(d.id), d.data()))
    .sort((a, b) => a.id - b.id);
}

export async function listAllQuests() {
  await ensureDefaults();
  const snaps = await db().collection("quests").limit(500).get();
  return snaps.docs
    .map((d) => questFromDoc(Number(d.id), d.data()))
    .sort((a, b) => b.id - a.id);
}

export async function getQuest(id: number) {
  const snap = await db().collection("quests").doc(String(id)).get();
  if (!snap.exists) return null;
  return questFromDoc(id, snap.data()!);
}

export async function createQuest(value: Omit<Quest, "id" | "createdAt" | "updatedAt"> & { createdBy: string }) {
  const id = await nextCounter("quests", 101);
  const stamp = nowIso();
  const quest: Quest = {
    id,
    sourceKey: value.sourceKey ?? null,
    title: value.title,
    type: value.type,
    description: value.description,
    place: value.place,
    steps: value.steps || "[]",
    puzzleSteps: value.puzzleSteps || "[]",
    xp: value.xp,
    hintCost: value.hintCost,
    hintText: value.hintText,
    hintImageKey: value.hintImageKey,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    status: value.status,
    tagIds: value.tagIds || [],
    requireScan: value.requireScan !== false,
    unlockMetric: value.unlockMetric ?? null,
    unlockAt: value.unlockAt ?? null,
    gameMode: value.gameMode || "custom",
    createdBy: value.createdBy,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const { id: _id, ...data } = quest;
  await db().collection("quests").doc(String(id)).set(data);
  return quest;
}

export async function updateQuest(id: number, changes: Record<string, unknown>) {
  const ref = db().collection("quests").doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.set({ ...changes, updatedAt: nowIso() }, { merge: true });
  return getQuest(id);
}

export async function uploadHintImage(key: string, data: Buffer, contentType: string) {
  const bucket = getStorageBucket();
  const file = bucket.file(key);
  await file.save(data, {
    contentType,
    resumable: false,
    metadata: { cacheControl: "public, max-age=3600" },
  });
  return key;
}

export async function readHintImage(key: string) {
  const bucket = getStorageBucket();
  const file = bucket.file(key);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();
  return {
    buffer,
    contentType: metadata.contentType || "application/octet-stream",
    etag: metadata.etag,
  };
}
