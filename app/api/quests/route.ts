import {
  communitySnapshot,
  getGameSettings,
  listPublishedQuests,
  listTags,
} from "@/lib/db";
import { isQuestUnlocked, scheduleGate } from "@/lib/db";
import { parsePuzzleSteps, parseStepLabels } from "@/lib/types";

export const dynamic = "force-dynamic";

function publicTag<T extends { accessCode?: string }>(tag: T) {
  const { accessCode: _hidden, ...rest } = tag;
  return rest;
}

export async function GET() {
  const [quests, tags, settings, community] = await Promise.all([
    listPublishedQuests(),
    listTags(),
    getGameSettings(),
    communitySnapshot(),
  ]);

  const scans = community.community.scans;
  const totalXp = community.community.totalXp;
  const now = Date.now();

  const payload = [];
  for (const q of quests) {
    const unlocked = await isQuestUnlocked(q, scans, totalXp, settings.unlocks);
    const schedule = scheduleGate(q, now);
    const unlockRule =
      q.unlockMetric && q.unlockMetric !== "none"
        ? {
            metric: q.unlockMetric,
            at: Number(q.unlockAt || 0),
            title: q.title,
            questId: q.id,
          }
        : settings.unlocks.find((u) => u.questId === q.id) || null;

      const { clues: _hiddenClues, ...publicQuest } = q;
    payload.push({
      ...publicQuest,
      steps: parseStepLabels(q.steps),
      puzzleSteps: parsePuzzleSteps(q.puzzleSteps).map((s) => ({
        id: s.id,
        type: s.type,
        prompt: s.prompt,
        choices: (s.choices || []).map((c) => ({ id: c.id, label: c.label })),
        tagId: s.tagId || null,
        // never send correct answers or unscanned clues to the client
      })),
      unlocked,
      scheduleOk: schedule.ok,
      scheduleError: schedule.ok ? null : schedule.error,
      unlockRule,
      tags: (q.tagIds || [])
        .map((id) => tags.find((t) => t.id === id))
        .filter((t) => Boolean(t))
        .map((t) => publicTag(t!)),
    });
  }

  return Response.json(
    {
      quests: payload,
      tags: tags.map(publicTag),
      settings: { simulateNfcEnabled: settings.simulateNfcEnabled },
      community: community.community,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
