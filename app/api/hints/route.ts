import { getProfileByToken, hintStatus, purchaseHint } from "@/lib/db";

export const dynamic = "force-dynamic";

async function nameFor(token: string) {
  return (await getProfileByToken(token))?.name;
}

export async function GET(request: Request) {
  const u = new URL(request.url);
  const name = await nameFor(u.searchParams.get("token") || "");
  const questId = Number(u.searchParams.get("questId"));
  if (!name) return Response.json({ error: "Profil saknas" }, { status: 401 });
  return Response.json(await hintStatus(name, questId), {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  const b = await request.json();
  const name = await nameFor(String(b.token || ""));
  const questId = Number(b.questId);
  const cost = Math.max(0, Math.min(5000, Number(b.cost) || 0));
  if (!name || !questId) {
    return Response.json({ error: "Ogiltigt köp" }, { status: 400 });
  }
  const result = await purchaseHint(name, questId, cost);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({
    purchased: result.purchased,
    xp: result.xp,
    alreadyOwned: result.alreadyOwned,
  });
}
