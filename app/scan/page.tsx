"use client";

import { FormEvent, useEffect, useState } from "react";
import { getPlayer } from "../player-session";

type Station = { id: string; name: string; stationKey: string; location: string };
type Phase = "reading" | "success" | "duplicate" | "profile" | "error" | "manual";

export default function ScanPage() {
  const [state, setState] = useState<Phase>("reading");
  const [station, setStation] = useState("");
  const [error, setError] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [manualKey, setManualKey] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submitScan = async (stationKey: string, accessCode: string) => {
    const p = getPlayer();
    if (!p) {
      setState("profile");
      return;
    }
    setBusy(true);
    setError("");
    setStation(stationKey);
    try {
      const r = await fetch("/api/community", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerName: p.name,
          stationKey,
          accessCode,
          xpGain: 20,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte registrera");
      setState(d.scanAwarded ? "success" : "duplicate");
      window.dispatchEvent(new Event("progress-updated"));
      window.dispatchEvent(new Event("community-scan"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
      setState("error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const key = params.get("station") || "";
    const code = params.get("k") || params.get("code") || "";
    fetch("/api/stations", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setStations(d.stations || []))
      .catch(() => {});

    if (!key) {
      setState("manual");
      return;
    }
    if (!getPlayer()) {
      setStation(key);
      setState("profile");
      return;
    }
    if (!code) {
      setStation(key);
      setManualKey(key);
      setState("manual");
      return;
    }
    submitScan(key, code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onManual = (e: FormEvent) => {
    e.preventDefault();
    submitScan(manualKey, manualCode);
  };

  return (
    <main className="scan-page">
      <section>
        <div className="scan-rings">
          <span>⌁</span>
        </div>
        <p className="eyebrow">GOOD GAME · STATION</p>

        {state === "reading" && (
          <>
            <h1>Läser signal…</h1>
            <p>Stationen verifieras mot din spelarprofil.</p>
          </>
        )}

        {state === "success" && (
          <>
            <h1>Signal registrerad!</h1>
            <p>
              Du fick <b>20 Chip</b> och skanningen uppgraderade Parkaden-kärnan.
            </p>
          </>
        )}

        {state === "duplicate" && (
          <>
            <h1>Redan skannad</h1>
            <p>
              Du har redan registrerat noden <b>{station}</b>. Varje fysisk nod ger bara Chip en
              gång per spelare.
            </p>
          </>
        )}

        {state === "profile" && (
          <>
            <h1>Spelarprofil saknas</h1>
            <p>Öppna spelet och skapa din profil först. Kom sedan tillbaka hit.</p>
          </>
        )}

        {state === "error" && (
          <>
            <h1>Registreringen misslyckades</h1>
            <p>{error || "Kontrollera koden på brickan och försök igen."}</p>
            <button className="ghost full" onClick={() => setState("manual")}>
              FÖRSÖK MED STATIONSKOD
            </button>
          </>
        )}

        {state === "manual" && (
          <>
            <h1>Ange stationskod</h1>
            <p>
              Ingen NFC? Läs den korta koden som sitter på brickan (inte en QR-bild). Det kräver att
              du är vid noden.
            </p>
            <form className="scan-manual-form" onSubmit={onManual}>
              <label>
                Station
                <select
                  required
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                >
                  <option value="">Välj station…</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.stationKey}>
                      {s.name} · {s.location}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kod på brickan
                <input
                  required
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="T.ex. K7P2"
                  autoComplete="off"
                  maxLength={8}
                />
              </label>
              {error && <p className="error-note">{error}</p>}
              <button className="primary full" disabled={busy}>
                {busy ? "REGISTRERAR…" : "REGISTRERA STATION"}
              </button>
            </form>
          </>
        )}

        <a className="primary full scan-return" href="/">
          TILLBAKA TILL SPELET
        </a>
      </section>
    </main>
  );
}
