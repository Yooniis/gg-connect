import { cookie, hashPin, newSalt, validPin } from "../pin";
import { getProfileByName, setProfilePin, updateTeam } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const b = await request.json();
  const name = String(b.name || "").trim().slice(0, 24);
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

  const salt = newSalt();
  const hash = await hashPin(pin, salt);
  await setProfilePin(row.token, hash, salt);
  // Flatten any legacy team into the shared community
  await updateTeam(row.token, "Solo");

  return Response.json(
    { player: { name: row.name, team: "Solo", token: row.token } },
    { headers: { "set-cookie": cookie(row.token) } },
  );
}
