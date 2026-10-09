"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ pin }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error || "Kunde inte logga in.");
        setBusy(false);
        return;
      }
      // Full reload so the HttpOnly admin cookie is picked up by the server page.
      window.location.assign("/admin");
    } catch {
      setError("Nätverksfel. Försök igen.");
      setBusy(false);
    }
  };

  return (
    <main className="admin-shell">
      <section className="admin-form-wrap" style={{ maxWidth: 420, margin: "4rem auto" }}>
        <p className="eyebrow">GOOD GAME · PARKADEN</p>
        <h1>Admin-PIN</h1>
        <p>Ange admin-PIN för att hantera uppdrag.</p>
        <form className="admin-form" onSubmit={submit}>
          <label>
            PIN
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </label>
          <button className="primary full" disabled={busy}>
            {busy ? "LOGGAR IN…" : "LOGGA IN"}
          </button>
          {error && <p className="form-message">{error}</p>}
        </form>
      </section>
    </main>
  );
}
