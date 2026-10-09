"use client";

import { FormEvent, useEffect, useState } from "react";
import { ensurePlayer, getPlayer, PlayerIdentity, savePlayer } from "./player-session";

type Mode = "welcome" | "create" | "login" | "claim" | "edit";

export default function PlayerOnboarding() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("welcome");
  const [player, setPlayer] = useState<PlayerIdentity | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = getPlayer();
    if (stored) {
      setPlayer(stored);
      ensurePlayer(stored)
        .then(() => window.dispatchEvent(new Event("progress-updated")))
        .catch(() => {});
    } else {
      setMode("welcome");
      setOpen(true);
    }
    const show = () => {
      const p = getPlayer();
      setPlayer(p);
      setName(p?.name || "");
      setPin("");
      setError("");
      setMode(p ? "edit" : "welcome");
      setOpen(true);
    };
    window.addEventListener("open-player-profile", show);
    return () => window.removeEventListener("open-player-profile", show);
  }, []);

  const finish = (p: PlayerIdentity) => {
    savePlayer({ ...p, team: "Solo" });
    setPlayer({ ...p, team: "Solo" });
    setOpen(false);
    setPin("");
    window.dispatchEvent(new Event("progress-updated"));
    window.dispatchEvent(new Event("community-scan"));
  };

  async function create(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const identity = { name: name.trim(), team: "Solo", token: crypto.randomUUID() };
      const data = await ensurePlayer(identity, pin);
      finish(data.player);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa profilen");
    } finally {
      setSaving(false);
    }
  }

  async function edit(e: FormEvent) {
    e.preventDefault();
    if (!player) return;
    setSaving(true);
    setError("");
    try {
      const data = await ensurePlayer({ ...player, name: name.trim(), team: "Solo" });
      finish(data.player);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara profilen");
    } finally {
      setSaving(false);
    }
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/player/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.code === "PIN_NOT_SET") setMode("claim");
        throw new Error(d.error);
      }
      finish(d.player);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inloggningen misslyckades");
    } finally {
      setSaving(false);
    }
  }

  async function claim(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/player/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });
      const text = await r.text();
      let d: { error?: string; player?: PlayerIdentity } = {};
      try {
        d = text ? JSON.parse(text) : {};
      } catch {}
      if (!r.ok || !d.player) {
        throw new Error(d.error || "Servern kunde inte aktivera profilen. Försök igen.");
      }
      finish(d.player);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte aktivera PIN-koden");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  const back = () => {
    setError("");
    setPin("");
    setMode("welcome");
  };

  return (
    <div className="modal-backdrop profile-backdrop">
      <section className="profile-modal account-modal">
        <div className="profile-symbol">GG</div>
        {mode !== "welcome" && mode !== "edit" && (
          <button className="account-back" onClick={back}>
            ← TILLBAKA
          </button>
        )}
        <p className="eyebrow">DIN SPELARPROFIL</p>
        {mode === "welcome" && (
          <>
            <h2>Välkommen till spelet</h2>
            <p>
              Alla spelar i samma community. Samla Chip, uppgradera kärnan tillsammans – och bara
              en kan toppa Chip-listan.
            </p>
            <div className="account-options">
              <button
                className="primary full"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                JAG HAR REDAN EN PROFIL
              </button>
              <button
                className="ghost full"
                onClick={() => {
                  setMode("create");
                  setError("");
                }}
              >
                SKAPA NY PROFIL
              </button>
            </div>
          </>
        )}
        {mode === "create" && (
          <>
            <h2>Skapa spelarprofil</h2>
            <p>
              Välj en PIN-kod som du kan använda om du byter mobil eller öppnar spelet på en annan
              enhet.
            </p>
            <form onSubmit={create}>
              <Name value={name} set={setName} />
              <Pin value={pin} set={setPin} label="Välj PIN-kod" />
              {error && <ErrorBox text={error} />}
              <button className="primary full" disabled={saving}>
                {saving ? "SKAPAR…" : "SKAPA & STARTA SPELET"}
              </button>
            </form>
          </>
        )}
        {mode === "login" && (
          <>
            <h2>Logga in</h2>
            <p>Använd samma spelarnamn och PIN-kod som när profilen skapades.</p>
            <form onSubmit={login}>
              <Name value={name} set={setName} />
              <Pin value={pin} set={setPin} label="PIN-kod" />
              {error && <ErrorBox text={error} />}
              <button className="primary full" disabled={saving}>
                {saving ? "LOGGAR IN…" : "LOGGA IN"}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setMode("claim");
                  setPin("");
                  setError("");
                }}
              >
                ÄLDRE PROFIL UTAN PIN-KOD?
              </button>
            </form>
          </>
        )}
        {mode === "claim" && (
          <>
            <h2>Aktivera äldre profil</h2>
            <p>Ange ditt spelarnamn och välj en ny PIN-kod så kan du logga in på fler enheter.</p>
            <form onSubmit={claim}>
              <Name value={name} set={setName} />
              <Pin value={pin} set={setPin} label="Ny PIN-kod" />
              {error && <ErrorBox text={error} />}
              <button className="primary full" disabled={saving}>
                {saving ? "AKTIVERAR…" : "AKTIVERA & LOGGA IN"}
              </button>
            </form>
          </>
        )}
        {mode === "edit" && (
          <>
            <h2>Redigera profil</h2>
            <p>Här ändrar du spelarens namn. Alla tillhör samma community.</p>
            <form onSubmit={edit}>
              <Name value={name} set={setName} />
              {error && <ErrorBox text={error} />}
              <button className="primary full" disabled={saving}>
                {saving ? "SPARAR…" : "SPARA PROFIL"}
              </button>
              <button type="button" className="ghost full" onClick={() => setOpen(false)}>
                AVBRYT
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function Name({ value, set }: { value: string; set: (v: string) => void }) {
  return (
    <label>
      Spelarnamn
      <input
        autoFocus
        required
        minLength={2}
        maxLength={24}
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder="Till exempel PixelMaja"
        autoComplete="username"
      />
    </label>
  );
}

function Pin({
  value,
  set,
  label,
}: {
  value: string;
  set: (v: string) => void;
  label: string;
}) {
  return (
    <label>
      {label}
      <input
        required
        inputMode="numeric"
        pattern="[0-9]{4,8}"
        minLength={4}
        maxLength={8}
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
        placeholder="4–8 siffror"
        autoComplete="current-password"
      />
      <small>Endast siffror. Spara koden så att du kan logga in på fler enheter.</small>
    </label>
  );
}

function ErrorBox({ text }: { text: string }) {
  return <div className="profile-error">{text}</div>;
}
