import {
  getQuest,
  listTags,
  playerQuestTagScans,
  recordQuestTagScan,
  sessionFromRequest,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const questId = Number(url.searchParams.get("questId"));
  const identity = await sessionFromRequest(request);
  if (!identity.name || !questId) {
    return Response.json({ scans: [], tags: [] });
  }
  const quest = await getQuest(questId);
  const tags = await listTags();
  const scans = await playerQuestTagScans(identity.name, questId, quest?.tagIds);
  return Response.json({
    scans,
    requiredTagIds: quest?.tagIds || [],
    requireScan: quest?.requireScan !== false,
    tags: tags.filter((t) => (quest?.tagIds || []).includes(t.id)),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const identity = await sessionFromRequest(
    request,
    String((body as { playerName?: string }).playerName || "").slice(0, 30),
  );
  if (!identity.name) {
    return Response.json({ error: "Profil saknas" }, { status: 401 });
  }
  const questId = Number((body as { questId?: number }).questId);
  const tagId = String((body as { tagId?: string }).tagId || "").trim();
  const stationKey = String((body as { stationKey?: string }).stationKey || "").trim();
  if (!questId || (!tagId && !stationKey)) {
    return Response.json({ error: "Ogiltig skanning" }, { status: 400 });
  }

  const quest = await getQuest(questId);
  if (!quest) return Response.json({ error: "Uppdraget saknas" }, { status: 404 });

  const tags = await listTags();
  const tag =
    tags.find((t) => t.id === tagId) ||
    tags.find((t) => t.stationKey === stationKey);
  if (!tag || !(quest.tagIds || []).includes(tag.id)) {
    return Response.json({ error: "Taggen hör inte till detta uppdrag." }, { status: 400 });
  }

  const result = await recordQuestTagScan({
    name: identity.name,
    questId,
    tagId: tag.id,
    stationKey: tag.stationKey,
  });

  return Response.json(result);
}
