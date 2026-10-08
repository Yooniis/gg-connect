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
    "xp",
    "hintCost",
    "hintText",
    "startsAt",
    "endsAt",
    "status",
  ] as const;

  const changes: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      changes[key] =
        body[key] || (key === "startsAt" || key === "endsAt" ? null : body[key]);
    }
  }

  const updated = await updateQuest(Number(id), changes);
  return updated
    ? Response.json({ quest: updated })
    : Response.json({ error: "Uppdraget hittades inte." }, { status: 404 });
}
