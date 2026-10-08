import { findCanonicalTeam, listTeams, updateTeam } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 30);
  return Response.json(
    { teams: await listTeams(q) },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const b = await request.json();
  const token = String(b.token || "").slice(0, 80);
  const requested =
    String(b.team || "Solo")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 30) || "Solo";

  if (requested !== "Solo" && requested.length < 2) {
    return Response.json(
      { error: "Lagnamnet måste ha minst två tecken." },
      { status: 400 },
    );
  }

  const team = await findCanonicalTeam(requested);
  const player = await updateTeam(token, team);
  if (!player) {
    return Response.json(
      { error: "Spelarprofilen kunde inte hittas." },
      { status: 404 },
    );
  }
  return Response.json({ player });
}
