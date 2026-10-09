import { requireAdminApi } from "@/lib/admin-session";
import { updateQuest } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminApi(request);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json();
  const allowed = [
    "title",
    "type",
    "description",
    "place",
    "steps",
    "puzzleSteps",
    "xp",
    "hintCost",
    "hintText",
    "startsAt",
    "endsAt",
    "status",
    "tagIds",
    "requireScan",
    "unlockMetric",
    "unlockAt",
    "gameMode",
  ] as const;

  const changes: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in body)) continue;
    if (key === "startsAt" || key === "endsAt") {
      changes[key] = body[key] || null;
    } else if (key === "tagIds") {
      changes[key] = Array.isArray(body[key]) ? body[key].map(String) : [];
    } else if (key === "steps" || key === "puzzleSteps") {
      changes[key] =
        typeof body[key] === "string" ? body[key] : JSON.stringify(body[key] ?? []);
    } else if (key === "requireScan") {
      changes[key] = Boolean(body[key]);
    } else if (key === "unlockAt") {
      changes[key] = body[key] == null || body[key] === "" ? null : Number(body[key]);
    } else if (key === "unlockMetric") {
      changes[key] =
        body[key] === "scans" || body[key] === "xp" || body[key] === "none"
          ? body[key]
          : null;
    } else {
      changes[key] = body[key];
    }
  }

  const updated = await updateQuest(Number(id), changes);
  return updated
    ? Response.json({ quest: updated })
    : Response.json({ error: "Uppdraget hittades inte." }, { status: 404 });
}
