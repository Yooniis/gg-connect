import {
  communitySnapshot,
  getGameSettings,
  listPublishedQuests,
  listTags,
} from "@/lib/db";
import { isQuestUnlocked, scheduleGate } from "@/lib/db";
import { parsePuzzleSteps, parseStepLabels } from "@/lib/types";

export const dynamic = "force-dynamic";

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

    payload.push({
      ...q,
      steps: parseStepLabels(q.steps),
      puzzleSteps: parsePuzzleSteps(q.puzzleSteps).map((s) => ({
        id: s.id,
        type: s.type,
        prompt: s.prompt,
        choices: (s.choices || []).map((c) => ({ id: c.id, label: c.label })),
        tagId: s.tagId || null,
        // never send correct answers to client
      })),
      unlocked,
      scheduleOk: schedule.ok,
      scheduleError: schedule.ok ? null : schedule.error,
      unlockRule,
      tags: tags.filter((t) => (q.tagIds || []).includes(t.id)),
    });
  }

  return Response.json(
    {
      quests: payload,
      tags,
      settings: { simulateNfcEnabled: settings.simulateNfcEnabled },
      community: community.community,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
