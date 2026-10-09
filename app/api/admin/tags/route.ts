import { requireAdminApi } from "@/lib/admin-session";
import { createTag, listTags } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAdminApi(request);
  if (denied) return denied;
  return Response.json({ tags: await listTags() });
}

export async function POST(request: Request) {
  const denied = await requireAdminApi(request);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const name = String((body as { name?: string }).name || "").trim();
  const stationKey = String((body as { stationKey?: string }).stationKey || "").trim();
  if (!name || !stationKey) {
    return Response.json({ error: "Namn och stationKey krävs." }, { status: 400 });
  }
  const tag = await createTag({
    name,
    stationKey,
    location: String((body as { location?: string }).location || ""),
    active: (body as { active?: boolean }).active !== false,
  });
  return Response.json({ tag }, { status: 201 });
}
