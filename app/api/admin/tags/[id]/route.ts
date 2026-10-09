import { requireAdminApi } from "@/lib/admin-session";
import { deleteTag, updateTag } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminApi(request);
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const updated = await updateTag(id, body as Record<string, unknown>);
  return updated
    ? Response.json({ tag: updated })
    : Response.json({ error: "Taggen hittades inte." }, { status: 404 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminApi(request);
  if (denied) return denied;
  const { id } = await params;
  await deleteTag(id);
  return Response.json({ ok: true });
}
