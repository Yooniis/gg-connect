import { cookie, hashPin, validPin } from "../pin";
import { getProfileByName } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const b = await request.json();
  const name = String(b.name || "").trim().slice(0, 24);
  const pin = String(b.pin || "");
  if (!name || !validPin(pin)) {
    return Response.json(
      { error: "Ange spelarnamn och PIN-kod." },
      { status: 400 },
    );
  }

  const row = await getProfileByName(name);
  if (!row) {
    return Response.json({ error: "Spelarprofilen finns inte." }, { status: 404 });
  }
  if (!row.pinHash || !row.pinSalt) {
    return Response.json(
      {
        error:
          "Den här äldre profilen saknar PIN-kod. Bekräfta laget och skapa en kod nu.",
        code: "PIN_NOT_SET",
      },
      { status: 409 },
    );
  }
  if ((await hashPin(pin, row.pinSalt)) !== row.pinHash) {
    return Response.json({ error: "Fel PIN-kod." }, { status: 401 });
  }

  return Response.json(
    { player: { name: row.name, team: row.team, token: row.token } },
    { headers: { "set-cookie": cookie(row.token) } },
  );
}
