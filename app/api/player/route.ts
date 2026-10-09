import { cookie, hashPin, newSalt, validPin } from "./pin";
import {
  getPlayer,
  getProfileByToken,
  teamMembers,
  upsertPlayerProfile,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return Response.json({ player: null });

  const profile = await getProfileByToken(token);
  if (!profile) {
    return Response.json(
      { player: null, members: [] },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const score = await getPlayer(profile.name);
  const player = {
    name: profile.name,
    team: profile.team,
    xp: score?.xp || 0,
    hasPin: Boolean(profile.pinHash),
  };

  let members: unknown[] = [];
  if (url.searchParams.get("includeTeam") === "1") {
    members = await teamMembers(profile.team);
  }

  return Response.json(
    { player, members },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const b = await request.json();
  const token = String(b.token || "").trim().slice(0, 80);
  const name = String(b.name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
  // Teams are disabled — everyone belongs to the shared community.
  const team = "Solo";

  if (token.length < 12 || name.length < 2) {
    return Response.json(
      { error: "Välj ett spelarnamn med minst två tecken." },
      { status: 400 },
    );
  }

  const previous = await getProfileByToken(token);
  const pin = String(b.pin || "");
  if (!previous && !validPin(pin)) {
    return Response.json(
      { error: "Välj en personlig PIN-kod med 4–8 siffror." },
      { status: 400 },
    );
  }

  const salt = !previous ? newSalt() : null;
  const hash = !previous && salt ? await hashPin(pin, salt) : null;

  const result = await upsertPlayerProfile({
    token,
    name,
    team,
    pinHash: hash,
    pinSalt: salt,
    isNew: !previous,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(
    { player: result.player },
    { headers: { "set-cookie": cookie(token) } },
  );
}
