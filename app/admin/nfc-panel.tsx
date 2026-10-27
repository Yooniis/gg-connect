"use client";

import { useEffect, useMemo, useState } from "react";
import { nfcScanUrl } from "@/lib/types";

type Tag = {
  id: string;
  name: string;
  stationKey: string;
  location: string;
  accessCode: string;
  active: boolean;
};

export default function AdminNfcPanel() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [origin, setOrigin] = useState("https://gg-parkaden.web.app");
  const [message, setMessage] = useState("");

  const load = async () => {
    const r = await fetch("/api/admin/tags");
    if (r.ok) setTags((await r.json()).tags || []);
  };

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, []);

  const rows = useMemo(
    () =>
      tags.map((t) => ({
        ...t,
        url: nfcScanUrl(origin, t),
      })),
    [tags, origin],
  );

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`Kopierade ${label}`);
    } catch {
      setMessage("Kunde inte kopiera – markera texten manuellt.");
    }
  };

  return (
    <section className="admin-nfc-panel">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">NFC-PROGRAMMERING</p>
          <h1>Brickor & länkar</h1>
        </div>
        <span>{rows.length} noder</span>
      </div>

      <div className="admin-help nfc-howto">
        <p>
          <b>Så programmerar du varje NFC-bricka:</b> skriv in länken under “NFC-länk” som NDEF-URL.
          Skriv också <b>stationskoden</b> synligt på brickan/hållaren (liten text). Spelare utan NFC
          anger station + kod i appen — ingen QR som går att fota på avstånd.
        </p>
        <label>
          Bas-URL
          <input value={origin} onChange={(e) => setOrigin(e.target.value)} />
        </label>
      </div>

      {message && <p className="form-message">{message}</p>}

      <div className="nfc-program-list">
        {rows.map((t, i) => (
          <article className="nfc-program-card" key={t.id}>
            <header>
              <span className="status published">{t.id}</span>
              <h3>
                {i + 1}. {t.name}
              </h3>
              <p>
                {t.location || "—"} · stationKey <code>{t.stationKey}</code>
              </p>
            </header>

            <div className="nfc-field">
              <label>Stationskod (skriv på brickan)</label>
              <div className="nfc-code-row">
                <strong>{t.accessCode}</strong>
                <button type="button" onClick={() => copy(t.accessCode, "koden")}>
                  KOPIERA KOD
                </button>
              </div>
            </div>

            <div className="nfc-field">
              <label>NFC-länk (klistra in i brickan)</label>
              <code className="nfc-url">{t.url}</code>
              <button type="button" onClick={() => copy(t.url, "länken")}>
                KOPIERA LÄNK
              </button>
            </div>

            <p className="nfc-sticker-hint">
              Klisterlapp: <b>{t.name}</b> · kod <b>{t.accessCode}</b>
            </p>
          </article>
        ))}
      </div>

      <button type="button" className="primary" onClick={() => window.print()}>
        SKRIV UT LISTA
      </button>
    </section>
  );
}
