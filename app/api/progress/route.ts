import {
  acceptQuest,
  completeQuest,
  progressSnapshot,
  sessionFromRequest,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get("player") || "";
  const identity = await sessionFromRequest(request, asked);
  if (!identity.name) {
    return Response.json(
      { player: null, completions: [] },
      { headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(await progressSnapshot(identity.name), {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  const b = await request.json();
  const identity = await sessionFromRequest(
    request,
    String(b.playerName || "").slice(0, 30),
  );
  const name = identity.name;
  const questId = Number(b.questId);
  const title = String(b.questTitle || "Uppdrag").slice(0, 80);
  if (!name || !questId) {
    return Response.json({ error: "Ogiltigt uppdrag" }, { status: 400 });
  }

  if (b.action === "accept") {
    const result = await acceptQuest(name, questId);
    return Response.json({
      accepted: true,
      startedNow: result.startedNow,
      acceptance: result.acceptance,
      ...(await progressSnapshot(name)),
    });
  }

  const result = await completeQuest({
    name,
    team: identity.team,
    questId,
    title,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    awarded: result.awarded,
    award: result.award,
    ...(await progressSnapshot(name)),
  });
}
