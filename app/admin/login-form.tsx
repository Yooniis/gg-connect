"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(data.error || "Kunde inte logga in.");
      return;
    }
    router.refresh();
  };

  return (
    <main className="admin-shell">
      <section className="admin-form-wrap" style={{ maxWidth: 420, margin: "4rem auto" }}>
        <p className="eyebrow">GOOD GAME · PARKADEN</p>
        <h1>Admin-PIN</h1>
        <p>Ange PIN-koden från miljövariabeln ADMIN_PIN för att hantera uppdrag.</p>
        <form className="admin-form" onSubmit={submit}>
          <label>
            PIN
            <input
              type="password"
              inputMode="numeric"
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
