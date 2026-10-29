import {
  getQuest,
  listTags,
  questRunState,
  recordQuestTagScan,
  sessionFromRequest,
  verifyStationAccess,
} from "@/lib/db";

function publicTag<T extends { accessCode?: string }>(tag: T) {
  const { accessCode: _hidden, ...rest } = tag;
  return rest;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const questId = Number(url.searchParams.get("questId"));
  const identity = await sessionFromRequest(request);
  if (!identity.name || !questId) {
    return Response.json({ scans: [], clues: [], tags: [] });
  }
  const [state, tags] = await Promise.all([
    questRunState(identity.name, questId),
    listTags(),
  ]);
  const ordered = state.requiredTagIds
    .map((id) => tags.find((t) => t.id === id))
    .filter((t) => Boolean(t))
    .map((t) => publicTag(t!));
  return Response.json({ ...state, tags: ordered });
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

  const accessCode = String(
    (body as { accessCode?: string; k?: string }).accessCode ||
      (body as { k?: string }).k ||
      "",
  );
  const gate = await verifyStationAccess(tag.stationKey, accessCode);
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status });
  }

  const result = await recordQuestTagScan({
    name: identity.name,
    questId,
    tagId: tag.id,
    stationKey: tag.stationKey,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(result);
}
