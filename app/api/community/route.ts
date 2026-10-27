import {
  communitySnapshot,
  getGameSettings,
  recordNfcScan,
  sessionFromRequest,
  verifyStationAccess,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await communitySnapshot(), {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => ({}));
  const identity = await sessionFromRequest(
    request,
    String((input as { playerName?: string }).playerName || "").slice(0, 30),
  );
  if (!identity.name) {
    return Response.json({ error: "Skapa en spelarprofil först" }, { status: 401 });
  }

  const gain = Math.max(
    0,
    Math.min(500, Number((input as { xpGain?: number }).xpGain) || 20),
  );
  const station =
    String((input as { stationKey?: string }).stationKey || "simulator")
      .trim()
      .slice(0, 80) || "simulator";
  const accessCode = String((input as { accessCode?: string; k?: string }).accessCode ||
    (input as { k?: string }).k ||
    "");

  const settings = await getGameSettings();
  const isSim = station === "simulator" || station.startsWith("sim-");
  if (isSim && !settings.simulateNfcEnabled) {
    return Response.json(
      { error: "NFC-simulering är avstängd av admin." },
      { status: 403 },
    );
  }

  if (!isSim) {
    const gate = await verifyStationAccess(station, accessCode);
    if (!gate.ok) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }
  }

  const result = await recordNfcScan({
    name: identity.name,
    team: identity.team,
    stationKey: station,
    xpGain: gain,
  });

  return Response.json({ ...result, ...(await communitySnapshot()) });
}
