import { cookie, hashPin, newSalt, validPin } from "../pin";
import { getProfileByName, setProfilePin } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const b = await request.json();
  const name = String(b.name || "").trim().slice(0, 24);
  const team = String(b.team || "").trim().slice(0, 30);
  const pin = String(b.pin || "");
  if (!name || !validPin(pin)) {
    return Response.json(
      { error: "Ange spelarnamn och en ny PIN-kod med 4–8 siffror." },
      { status: 400 },
    );
  }

  const row = await getProfileByName(name);
  if (!row) {
    return Response.json({ error: "Spelarprofilen finns inte." }, { status: 404 });
  }
  if (row.pinHash) {
    return Response.json(
      { error: "Profilen har redan en PIN-kod. Logga in i stället." },
      { status: 409 },
    );
  }

  const savedTeam = (row.team || "Solo").trim();
  const isSolo = savedTeam.toLocaleLowerCase("sv-SE") === "solo";
  if (
    (!team && !isSolo) ||
    (team &&
      savedTeam.toLocaleLowerCase("sv-SE") !== team.toLocaleLowerCase("sv-SE"))
  ) {
    return Response.json(
      {
        error:
          "Lagnamnet stämmer inte med profilen. Spelade du solo, lämna fältet tomt.",
      },
      { status: 401 },
    );
  }

  const salt = newSalt();
  const hash = await hashPin(pin, salt);
  await setProfilePin(row.token, hash, salt);

  return Response.json(
    { player: { name: row.name, team: savedTeam, token: row.token } },
    { headers: { "set-cookie": cookie(row.token) } },
  );
}
