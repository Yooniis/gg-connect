"use client";

import { useCallback, useEffect, useState } from "react";
import { getPlayer } from "./player-session";

type Player = { name: string; team: string; xp: number };
type Unlock = {
  at: number;
  title: string;
  questId: number;
  unlocked: boolean;
  metric?: "scans" | "xp" | "none";
  current?: number;
  unit?: string;
};
type Community = {
  scans: number;
  totalXp?: number;
  goal: number;
  level: number;
  contributors: number;
  nodes: number;
  next: Unlock | null;
  unlocks: Unlock[];
};
type Data = { board: Player[]; community: Community | null };

export default function LiveCommunity() {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(
    () =>
      fetch("/api/community", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setData(d)),
    [],
  );
  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    const refresh = () => load();
    window.addEventListener("community-scan", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("community-scan", refresh);
    };
  }, [load]);

  if (!data?.community) return null;
  const c = data.community;
  const next = c.next;
  const metric = next?.metric || "scans";
  const current =
    metric === "xp" ? Number(c.totalXp || 0) : c.scans;
  const nextAt = next?.at || c.goal;
  const stageStart =
    [0, ...c.unlocks.filter((u) => u.unlocked).map((u) => u.at)].filter((n) => n <= current).at(-1) ||
    0;
  const pct = Math.min(
    100,
    Math.round(((current - stageStart) / Math.max(1, nextAt - stageStart)) * 100),
  );
  const me = getPlayer()?.name;
  const unit = metric === "xp" ? "Chip" : "skanningar";

  return (
    <section className="live-community" id="community-core">
      <div className="community-card">
        <div className="live-title">
          <span className="pulse-dot" />
          <div>
            <small>COMMUNITY UNLOCK · ALLA HJÄLPS ÅT</small>
            <h2>Kärnnivå {c.level}</h2>
          </div>
          <strong>
            {c.scans}
            <small> skanningar</small>
          </strong>
        </div>
        <p>
          Varje skanning och varje Chip uppgraderar Parkaden-kärnan. Tillsammans höjer ni
          kärnnivån — en tar Chip-toppen. Boss och andra mål låses via skanningar eller
          communityns totala Chip.
        </p>
        <div className="community-stats">
          <span>
            <b>{c.contributors}</b> bidrar
          </span>
          <span>
            <b>{c.nodes}</b> noder hittade
          </span>
          <span>
            <b>{(c.totalXp || 0).toLocaleString("sv-SE")}</b> Chip totalt
          </span>
          <span>
            <b>{c.unlocks.filter((u) => u.unlocked).length}</b> quests upplåsta
          </span>
        </div>
        <div className="community-track">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="community-meta">
          <b>{pct}% MOT NÄSTA NIVÅ</b>
          <span>
            {next
              ? `${Math.max(0, next.at - current).toLocaleString("sv-SE")} ${unit} kvar till ${next.title}`
              : "ALLA UTMANINGAR ÄR UPPLÅSTA"}
          </span>
        </div>
        <div className="unlock-road">
          {c.unlocks.map((u, i) => (
            <div
              key={`${u.questId}-${u.at}`}
              className={u.unlocked ? "done" : u === c.next ? "next" : "locked"}
            >
              <i>{u.unlocked ? "✓" : i + 1}</i>
              <span>
                <small>
                  {u.at.toLocaleString("sv-SE")} {u.metric === "xp" ? "CHIP" : "SKANNINGAR"}
                </small>
                <b>{u.title}</b>
              </span>
              <em>{u.unlocked ? "UPPLÅST" : u === c.next ? "NÄSTA MÅL" : "LÅST"}</em>
            </div>
          ))}
        </div>
      </div>
      <div className="scoreboard-card">
        <div className="score-head">
          <div>
            <small>LIVE SCOREBOARD</small>
            <h2>Chip-toppen</h2>
          </div>
          <button onClick={() => setOpen((v) => !v)}>{open ? "VISA TOPP 5" : "VISA ALLA"}</button>
        </div>
        <ol>
          {data.board.slice(0, open ? 10 : 5).map((p, i) => (
            <li key={p.name} className={p.name === me ? "me" : ""}>
              <b>{i + 1}</b>
              <span>
                <strong>{p.name}</strong>
                <small>Community</small>
              </span>
              <em>{p.xp.toLocaleString("sv-SE")} Chip</em>
            </li>
          ))}
        </ol>
        <div className="live-updated">
          <i /> Uppdateras automatiskt var tionde sekund
        </div>
      </div>
    </section>
  );
}
