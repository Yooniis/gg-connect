import { requireAdminApi } from "@/lib/admin-session";
import { createQuest, listAllQuests, uploadHintImage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAdminApi(request);
  if (denied) return denied;
  return Response.json({ quests: await listAllQuests() });
}

export async function POST(request: Request) {
  const denied = await requireAdminApi(request);
  if (denied) return denied;

  const form = await request.formData();
  const title = String(form.get("title") || "").trim();
  if (!title) return Response.json({ error: "Titel krävs." }, { status: 400 });

  let hintImageKey: string | null = null;
  const image = form.get("image");
  if (image instanceof File && image.size) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
      return Response.json(
        { error: "Bilden måste vara JPG, PNG eller WebP." },
        { status: 400 },
      );
    }
    if (image.size > 5_000_000) {
      return Response.json(
        { error: "Bilden får vara högst 5 MB." },
        { status: 400 },
      );
    }
    const ext = image.type.split("/")[1].replace("jpeg", "jpg");
    hintImageKey = `quest-hints/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await image.arrayBuffer());
    await uploadHintImage(hintImageKey, buffer, image.type);
  }

  const quest = await createQuest({
    sourceKey: null,
    title,
    type: String(form.get("type") || "SOLO"),
    description: String(form.get("description") || ""),
    place: String(form.get("place") || ""),
    steps: "[]",
    xp: Number(form.get("xp") || 0),
    hintCost: Number(form.get("hintCost") || 0),
    hintText: String(form.get("hintText") || ""),
    hintImageKey,
    startsAt: String(form.get("startsAt") || "") || null,
    endsAt: String(form.get("endsAt") || "") || null,
    status: String(form.get("status")) === "published" ? "published" : "draft",
    createdBy: "admin",
  });

  return Response.json({ quest }, { status: 201 });
}
