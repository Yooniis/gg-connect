"use client";

import { FormEvent, useEffect, useState } from "react";
import { defaultQuestData } from "../defaultQuestData";

type UnlockMetric = "scans" | "xp" | "none" | "";
type PuzzleStep = {
  id: string;
  type: "code" | "text" | "choice";
  prompt: string;
  answer?: string;
  choices?: { id: string; label: string; correct?: boolean }[];
  tagId?: string | null;
};
type Quest = {
  id: number;
  sourceKey?: string | null;
  title: string;
  type: string;
  description: string;
  place: string;
  xp: number;
  hintCost: number;
  hintText: string;
  hintImageKey: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  tagIds?: string[];
  requireScan?: boolean;
  unlockMetric?: UnlockMetric | null;
  unlockAt?: number | null;
  gameMode?: string | null;
  puzzleSteps?: string;
  steps?: string;
};
type Tag = {
  id: string;
  name: string;
  stationKey: string;
  location: string;
  active: boolean;
};
type UnlockRule = {
  questId: number;
  title: string;
  metric: "scans" | "xp" | "none";
  at: number;
};

type FormState = {
  title: string;
  type: string;
  description: string;
  place: string;
  xp: number;
  hintCost: number;
  hintText: string;
  startsAt: string;
  endsAt: string;
  status: string;
  tagIds: string[];
  requireScan: boolean;
  unlockMetric: UnlockMetric;
  unlockAt: string;
  gameMode: string;
  puzzleSteps: PuzzleStep[];
};

const empty: FormState = {
  title: "",
  type: "SOLO",
  description: "",
  place: "",
  xp: 250,
  hintCost: 100,
  hintText: "",
  startsAt: "",
  endsAt: "",
  status: "draft",
  tagIds: [],
  requireScan: true,
  unlockMetric: "",
  unlockAt: "",
  gameMode: "custom",
  puzzleSteps: [],
};

const fallbackQuests: Quest[] = defaultQuestData.map((q, i) => ({
  ...q,
  id: -(i + 1),
  hintCost: 100,
  hintText: "",
  hintImageKey: null,
  startsAt: null,
  endsAt: null,
  status: "published",
}));

function parseSteps(raw?: string): PuzzleStep[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminQuestEditor() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState<FormState>(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [simulateNfc, setSimulateNfc] = useState(true);
  const [unlocks, setUnlocks] = useState<UnlockRule[]>([]);
  const [tab, setTab] = useState<"quests" | "tags" | "unlocks">("quests");
  const [tagForm, setTagForm] = useState({ name: "", stationKey: "", location: "" });

  const load = async () => {
    try {
      const [qRes, tRes, sRes] = await Promise.all([
        fetch("/api/admin/quests"),
        fetch("/api/admin/tags"),
        fetch("/api/admin/settings"),
      ]);
      const saved = qRes.ok ? (await qRes.json()).quests : [];
      setQuests([
        ...saved,
        ...fallbackQuests.filter(
          (f) => !saved.some((q: Quest) => q.sourceKey === f.sourceKey || q.title === f.title),
        ),
      ]);
      if (tRes.ok) setTags((await tRes.json()).tags || []);
      if (sRes.ok) {
        const s = (await sRes.json()).settings;
        setSimulateNfc(s.simulateNfcEnabled !== false);
        setUnlocks(s.unlocks || []);
      }
    } catch {
      setQuests(fallbackQuests);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const change = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((v) => ({ ...v, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    let r: Response;
    const payload = {
      ...form,
      unlockMetric: form.unlockMetric || null,
      unlockAt: form.unlockAt === "" ? null : Number(form.unlockAt),
      puzzleSteps: form.puzzleSteps,
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
    };

    if (editing && editing > 0) {
      r = await fetch(`/api/admin/quests/${editing}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      const body = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (k === "tagIds" || k === "puzzleSteps") body.append(k, JSON.stringify(v));
        else if (v == null) body.append(k, "");
        else body.append(k, String(v));
      });
      if (image) body.append("image", image);
      r = await fetch("/api/admin/quests", { method: "POST", body });
    }
    const data = await r.json();
    setBusy(false);
    if (r.ok) {
      setForm(empty);
      setEditing(null);
      setImage(null);
      setMessage("Uppdraget har sparats.");
      load();
    } else setMessage(data.error || "Kunde inte spara.");
  };

  const edit = (q: Quest) => {
    setEditing(q.id);
    setForm({
      title: q.title,
      type: q.type,
      description: q.description,
      place: q.place,
      xp: q.xp,
      hintCost: q.hintCost,
      hintText: q.hintText,
      startsAt: toLocalInput(q.startsAt),
      endsAt: toLocalInput(q.endsAt),
      status: q.status,
      tagIds: q.tagIds || [],
      requireScan: q.requireScan !== false,
      unlockMetric: (q.unlockMetric as UnlockMetric) || "",
      unlockAt: q.unlockAt == null ? "" : String(q.unlockAt),
      gameMode: q.gameMode || (q.id === 5 ? "silence" : q.id <= 10 ? "builtin" : "custom"),
      puzzleSteps: parseSteps(q.puzzleSteps),
    });
    setTab("quests");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggle = async (q: Quest) => {
    if (q.id < 0) return;
    await fetch(`/api/admin/quests/${q.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: q.status === "published" ? "draft" : "published" }),
    });
    load();
  };

  const saveSettings = async (nextSimulate: boolean, nextUnlocks: UnlockRule[]) => {
    setBusy(true);
    const r = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ simulateNfcEnabled: nextSimulate, unlocks: nextUnlocks }),
    });
    setBusy(false);
    if (r.ok) {
      setSimulateNfc(nextSimulate);
      setUnlocks(nextUnlocks);
      setMessage("Inställningar sparade.");
    } else setMessage("Kunde inte spara inställningar.");
  };

  const addTag = async (e: FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tagForm),
    });
    if (r.ok) {
      setTagForm({ name: "", stationKey: "", location: "" });
      load();
    }
  };

  const addPuzzleStep = () => {
    change("puzzleSteps", [
      ...form.puzzleSteps,
      {
        id: `s${Date.now()}`,
        type: "code",
        prompt: "",
        answer: "",
        choices: [],
        tagId: null,
      },
    ]);
  };

  const updateStep = (index: number, patch: Partial<PuzzleStep>) => {
    change(
      "puzzleSteps",
      form.puzzleSteps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  };

  return (
    <div className="admin-grid admin-grid-wide">
      <section className="admin-list">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">ADMIN</p>
            <h1>Konfigurera spelet</h1>
          </div>
          <span>{quests.length} uppdrag · {tags.length} taggar</span>
        </div>

        <div className="admin-tabs">
          {(
            [
              ["quests", "Uppdrag"],
              ["tags", "NFC-taggar"],
              ["unlocks", "Upplåsning"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <label className="admin-toggle">
          <input
            type="checkbox"
            checked={simulateNfc}
            onChange={(e) => saveSettings(e.target.checked, unlocks)}
          />
          <span>Tillåt simulera NFC (för test utan brickor)</span>
        </label>

        {tab === "quests" && (
          <>
            {!quests.length && <div className="admin-empty">Skapa det första uppdraget.</div>}
            {quests.map((q) => (
              <article className="admin-quest" key={q.id}>
                <div>
                  <span className={`status ${q.status}`}>
                    {q.status === "published" ? "PUBLICERAT" : "UTKAST"}
                  </span>
                  <h3>{q.title}</h3>
                  <p>
                    {q.place || "Ingen plats"} · {q.xp} XP · {(q.tagIds || []).length} taggar ·{" "}
                    {q.gameMode || "custom"}
                  </p>
                  {q.startsAt && (
                    <small>
                      {new Date(q.startsAt).toLocaleString("sv-SE")}
                      {q.endsAt ? ` → ${new Date(q.endsAt).toLocaleString("sv-SE")}` : ""}
                    </small>
                  )}
                </div>
                {q.hintImageKey && (
                  <img src={`/api/quest-image/${q.hintImageKey}`} alt="Ledtrådsbild" />
                )}
                <div className="admin-actions">
                  <button onClick={() => edit(q)} disabled={q.id < 0 && false}>
                    REDIGERA
                  </button>
                  {q.id > 0 && (
                    <button onClick={() => toggle(q)}>
                      {q.status === "published" ? "GÖR TILL UTKAST" : "PUBLICERA"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </>
        )}

        {tab === "tags" && (
          <div className="admin-tags">
            <form className="admin-inline-form" onSubmit={addTag}>
              <input
                required
                placeholder="Namn"
                value={tagForm.name}
                onChange={(e) => setTagForm((v) => ({ ...v, name: e.target.value }))}
              />
              <input
                required
                placeholder="stationKey (URL)"
                value={tagForm.stationKey}
                onChange={(e) => setTagForm((v) => ({ ...v, stationKey: e.target.value }))}
              />
              <input
                placeholder="Plats"
                value={tagForm.location}
                onChange={(e) => setTagForm((v) => ({ ...v, location: e.target.value }))}
              />
              <button type="submit">LÄGG TILL TAGG</button>
            </form>
            {tags.map((t) => (
              <article className="admin-quest" key={t.id}>
                <div>
                  <span className="status published">{t.id}</span>
                  <h3>{t.name}</h3>
                  <p>
                    /scan?station={t.stationKey} · {t.location || "—"}
                  </p>
                </div>
                <div className="admin-actions">
                  <button
                    onClick={async () => {
                      await fetch(`/api/admin/tags/${t.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ active: !t.active }),
                      });
                      load();
                    }}
                  >
                    {t.active ? "INAKTIVERA" : "AKTIVERA"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {tab === "unlocks" && (
          <div className="admin-unlocks">
            <p className="admin-help">
              Community-upplåsning: välj skanningar eller total XP. Boss defaultar till XP – ändra fritt.
            </p>
            {unlocks.map((u, i) => (
              <div className="unlock-edit-row" key={`${u.questId}-${i}`}>
                <input
                  value={u.title}
                  onChange={(e) =>
                    setUnlocks((list) =>
                      list.map((x, n) => (n === i ? { ...x, title: e.target.value } : x)),
                    )
                  }
                />
                <input
                  type="number"
                  value={u.questId}
                  onChange={(e) =>
                    setUnlocks((list) =>
                      list.map((x, n) =>
                        n === i ? { ...x, questId: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                <select
                  value={u.metric}
                  onChange={(e) =>
                    setUnlocks((list) =>
                      list.map((x, n) =>
                        n === i
                          ? { ...x, metric: e.target.value as UnlockRule["metric"] }
                          : x,
                      ),
                    )
                  }
                >
                  <option value="scans">Skanningar</option>
                  <option value="xp">Community XP</option>
                  <option value="none">Alltid öppen</option>
                </select>
                <input
                  type="number"
                  value={u.at}
                  onChange={(e) =>
                    setUnlocks((list) =>
                      list.map((x, n) =>
                        n === i ? { ...x, at: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setUnlocks((list) => list.filter((_, n) => n !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            <div className="admin-actions">
              <button
                type="button"
                onClick={() =>
                  setUnlocks((list) => [
                    ...list,
                    { questId: 0, title: "Nytt mål", metric: "scans", at: 100 },
                  ])
                }
              >
                LÄGG TILL MÅL
              </button>
              <button type="button" className="primary" onClick={() => saveSettings(simulateNfc, unlocks)}>
                SPARA UPPLÅSNING
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="admin-form-wrap">
        <p className="eyebrow">{editing ? "REDIGERA UPPDRAG" : "NYTT UPPDRAG"}</p>
        <h2>{editing ? "Ändra quest" : "Skapa quest"}</h2>
        {editing && (
          <button
            className="cancel-edit"
            onClick={() => {
              setEditing(null);
              setForm(empty);
            }}
          >
            AVBRYT
          </button>
        )}
        <form className="admin-form" onSubmit={submit}>
          <label>
            Titel
            <input required value={form.title} onChange={(e) => change("title", e.target.value)} />
          </label>
          <div className="field-row">
            <label>
              Typ
              <select value={form.type} onChange={(e) => change("type", e.target.value)}>
                <option>SOLO</option>
                <option>LAG</option>
                <option>EVENT</option>
              </select>
            </label>
            <label>
              Status
              <select value={form.status} onChange={(e) => change("status", e.target.value)}>
                <option value="draft">Utkast</option>
                <option value="published">Publicerat</option>
              </select>
            </label>
          </div>
          <label>
            Beskrivning
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => change("description", e.target.value)}
            />
          </label>
          <label>
            Plats eller rutt
            <input
              value={form.place}
              onChange={(e) => change("place", e.target.value)}
              placeholder="Övre foajén → TV-hörnan"
            />
          </label>
          <div className="field-row">
            <label>
              Belöning (XP)
              <input
                type="number"
                min="0"
                value={form.xp}
                onChange={(e) => change("xp", Number(e.target.value))}
              />
            </label>
            <label>
              Ledtråd kostar
              <input
                type="number"
                min="0"
                value={form.hintCost}
                onChange={(e) => change("hintCost", Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            Ledtrådstext
            <textarea
              rows={2}
              value={form.hintText}
              onChange={(e) => change("hintText", e.target.value)}
            />
          </label>
          {!editing && (
            <label className="image-upload">
              Ledtrådsbild
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setImage(e.target.files?.[0] || null)}
              />
              <span>{image ? image.name : "Välj en bild av platsen"}</span>
            </label>
          )}
          <div className="field-row">
            <label>
              Starttid
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => change("startsAt", e.target.value)}
              />
            </label>
            <label>
              Sluttid
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => change("endsAt", e.target.value)}
              />
            </label>
          </div>

          <div className="field-row">
            <label>
              Spelläge
              <select value={form.gameMode} onChange={(e) => change("gameMode", e.target.value)}>
                <option value="custom">Konfigurerbara steg</option>
                <option value="silence">Tyst kommunikation (mic)</option>
                <option value="builtin">Inbyggt minispel</option>
              </select>
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={form.requireScan}
                onChange={(e) => change("requireScan", e.target.checked)}
              />
              Kräv NFC innan fortsättning
            </label>
          </div>

          <fieldset className="admin-fieldset">
            <legend>NFC-taggar för uppdraget</legend>
            <div className="tag-check-grid">
              {tags.map((t) => (
                <label key={t.id}>
                  <input
                    type="checkbox"
                    checked={form.tagIds.includes(t.id)}
                    onChange={(e) =>
                      change(
                        "tagIds",
                        e.target.checked
                          ? [...form.tagIds, t.id]
                          : form.tagIds.filter((id) => id !== t.id),
                      )
                    }
                  />
                  <span>
                    <b>{t.id}</b> {t.name}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="field-row">
            <label>
              Egen upplåsning
              <select
                value={form.unlockMetric}
                onChange={(e) => change("unlockMetric", e.target.value as UnlockMetric)}
              >
                <option value="">Använd community-listan</option>
                <option value="none">Alltid öppen</option>
                <option value="scans">Skanningar</option>
                <option value="xp">Community XP</option>
              </select>
            </label>
            <label>
              Tröskel
              <input
                type="number"
                min="0"
                value={form.unlockAt}
                disabled={!form.unlockMetric || form.unlockMetric === "none"}
                onChange={(e) => change("unlockAt", e.target.value)}
              />
            </label>
          </div>

          {form.gameMode === "custom" && (
            <fieldset className="admin-fieldset">
              <legend>Pusselsteg</legend>
              {form.puzzleSteps.map((step, i) => (
                <div className="puzzle-step-edit" key={step.id}>
                  <div className="field-row">
                    <label>
                      Typ
                      <select
                        value={step.type}
                        onChange={(e) =>
                          updateStep(i, { type: e.target.value as PuzzleStep["type"] })
                        }
                      >
                        <option value="code">Kod</option>
                        <option value="text">Fri text</option>
                        <option value="choice">Flerval</option>
                      </select>
                    </label>
                    <label>
                      Kräv tagg
                      <select
                        value={step.tagId || ""}
                        onChange={(e) => updateStep(i, { tagId: e.target.value || null })}
                      >
                        <option value="">Ingen</option>
                        {tags.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.id} · {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Fråga
                    <input
                      value={step.prompt}
                      onChange={(e) => updateStep(i, { prompt: e.target.value })}
                    />
                  </label>
                  {step.type !== "choice" ? (
                    <label>
                      Rätt svar
                      <input
                        value={step.answer || ""}
                        onChange={(e) => updateStep(i, { answer: e.target.value })}
                      />
                    </label>
                  ) : (
                    <label>
                      Alternativ (rätt markeras med *)
                      <textarea
                        rows={3}
                        value={(step.choices || [])
                          .map((c) => `${c.correct ? "* " : ""}${c.label}`)
                          .join("\n")}
                        onChange={(e) =>
                          updateStep(i, {
                            choices: e.target.value
                              .split("\n")
                              .filter(Boolean)
                              .map((line, n) => {
                                const correct = line.trim().startsWith("*");
                                const label = line.replace(/^\*\s*/, "").trim();
                                return { id: `c${n}`, label, correct };
                              }),
                          })
                        }
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    className="ghost"
                    onClick={() =>
                      change(
                        "puzzleSteps",
                        form.puzzleSteps.filter((_, n) => n !== i),
                      )
                    }
                  >
                    Ta bort steg
                  </button>
                </div>
              ))}
              <button type="button" onClick={addPuzzleStep}>
                + LÄGG TILL STEG
              </button>
            </fieldset>
          )}

          <button className="primary full" disabled={busy}>
            {busy ? "SPARAR…" : editing ? "SPARA ÄNDRINGAR" : "SPARA UPPDRAG"}
          </button>
          {message && <p className="form-message">{message}</p>}
        </form>
      </section>
    </div>
  );
}
