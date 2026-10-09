"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Player = { name: string; team: string; xp: number };
type Activity = {
  id: number;
  playerName: string;
  kind: string;
  message: string;
  xp: number;
};
type Unlock = {
  at: number;
  title: string;
  unlocked: boolean;
  metric?: "scans" | "xp" | "none";
  questId?: number;
};
type Data = {
  board: Player[];
  community: {
    scans: number;
    totalXp?: number;
    goal: number;
    level: number;
    contributors: number;
    nodes: number;
    next: Unlock | null;
    unlocks: Unlock[];
  } | null;
  activities: Activity[];
};

export default function ProjectorLive() {
  const [data, setData] = useState<Data | null>(null);
  const [clock, setClock] = useState("");
  const [slide, setSlide] = useState(0);
  const [burst, setBurst] = useState<Activity | null>(null);
  const [questUnlock, setQuestUnlock] = useState<string | null>(null);
  const last = useRef<number | null>(null);
  const knownUnlocks = useRef<Set<string>>(new Set());

  useEffect(() => {
    const load = () =>
      fetch("/api/community", { cache: "no-store" })
        .then((r) => r.json())
        .then((next: Data) => {
          const newest = next.activities?.[0];
          if (last.current !== null && newest && newest.id > last.current) {
            setBurst(newest);
            setTimeout(() => setBurst(null), 5200);
            if (newest.kind === "unlock") {
              const title = newest.message.replace(/^låste upp\s+/i, "");
              setQuestUnlock(title);
              setTimeout(() => setQuestUnlock(null), 9000);
            }
          }
          if (newest) last.current = newest.id;

          for (const u of next.community?.unlocks || []) {
            const key = `${u.questId}:${u.at}:${u.metric}`;
            if (u.unlocked && knownUnlocks.current.size && !knownUnlocks.current.has(key)) {
              setQuestUnlock(u.title);
              setTimeout(() => setQuestUnlock(null), 9000);
            }
            if (u.unlocked) knownUnlocks.current.add(key);
          }
          if (!knownUnlocks.current.size) {
            for (const u of next.community?.unlocks || []) {
              if (u.unlocked) knownUnlocks.current.add(`${u.questId}:${u.at}:${u.metric}`);
            }
          }

          setData(next);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 3000);
    const tick = setInterval(
      () =>
        setClock(
          new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }),
        ),
      1000,
    );
    const rotate = setInterval(() => setSlide((s) => s + 1), 7000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      clearInterval(rotate);
    };
  }, []);

  const board = data?.board || [];
  const community = data?.community;
  const scans = community?.scans || 0;
  const totalXp = community?.totalXp || 0;
  const goal = community?.goal || 500;
  const next = community?.next;
  const metric = next?.metric || "scans";
  const current = metric === "xp" ? totalXp : scans;
  const nextAt = next?.at || goal;
  const previous =
    [0, ...(community?.unlocks || []).filter((u) => u.unlocked).map((u) => u.at)].at(-1) || 0;
  const pct = Math.min(
    100,
    Math.round(((current - previous) / Math.max(1, nextAt - previous)) * 100),
  );
  const level = community?.level || 1;
  const unit = metric === "xp" ? "XP" : "skanningar";

  const messages = useMemo(() => {
    const leader = board[0];
    const second = board[1];
    const gap = leader && second ? leader.xp - second.xp : 0;
    const recent = data?.activities?.[0];
    return [
      recent
        ? `${recent.playerName} ${recent.message}${recent.xp ? ` · +${recent.xp} XP` : ""}`
        : "Jakten på XP-toppen har börjat!",
      leader
        ? `${leader.name} leder med ${gap.toLocaleString("sv-SE")} XP`
        : "Vem tar ledningen?",
      next
        ? `${Math.max(0, next.at - current).toLocaleString("sv-SE")} ${unit} kvar tills ${next.title} låses upp`
        : "Alla community-utmaningar är upplåsta!",
      board[2] ? `${board[2].name} jagar pallplatsen!` : "Vem tar tredjeplatsen?",
      `${(totalXp || 0).toLocaleString("sv-SE")} XP i communityn · ${community?.contributors || 0} spelare · ${community?.nodes || 0} noder`,
    ];
  }, [board, current, next, data, community, unit, totalXp]);

  return (
    <main className="projector">
      <div className="projector-noise" />
      {questUnlock && (
        <div className="quest-unlock-banner">
          <div className="unlock-flash" />
          <small>COMMUNITY SIGNAL</small>
          <h1>Ny Quest upplåst</h1>
          <h2>{questUnlock}</h2>
          <p>Alla spelare kan nu anta uppdraget</p>
        </div>
      )}
      {burst && !questUnlock && (
        <div className={`xp-burst ${burst.kind}`}>
          <div className="burst-rays" />
          <div className="xp-particles">
            {Array.from({ length: 18 }, (_, i) => (
              <i key={i} style={{ "--n": i } as React.CSSProperties} />
            ))}
          </div>
          <small>
            {burst.kind === "unlock"
              ? "COMMUNITY UNLOCK"
              : burst.kind === "quest"
                ? "UPPDRAG SLUTFÖRT"
                : "NY NFC-SKANNING"}
          </small>
          <h1>{burst.kind === "unlock" ? "UPPLÅST!" : `+${burst.xp} XP`}</h1>
          <h2>{burst.playerName}</h2>
          <p>{burst.message}</p>
        </div>
      )}
      <header>
        <a href="/admin" className="projector-brand">
          <img src="/gg-logo.png" alt="Good Game" />
          <span>
            PARKADEN <b>LIVE</b>
          </span>
        </a>
        <div className="projector-status">
          <i /> LIVE · HÄRNÖSAND
        </div>
        <time>{clock}</time>
        <button onClick={() => document.documentElement.requestFullscreen?.()}>
          ⛶ HELSKÄRM
        </button>
      </header>
      <section className="projector-main">
        <div className="projector-score">
          <div className="screen-label">LIVE SCOREBOARD · XP</div>
          <ol>
            {board.slice(0, 5).map((p, i) => (
              <li key={p.name} className={`rank-${i + 1}`}>
                <b>{i + 1}</b>
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.team}</small>
                </span>
                <em>
                  {p.xp.toLocaleString("sv-SE")} <small>XP</small>
                </em>
              </li>
            ))}
          </ol>
        </div>
        <div className="projector-community">
          <div className="screen-label">
            COMMUNITY UNLOCK · {community?.contributors || 0} BIDRAR
          </div>
          <div className="core-level">
            <span>KÄRNNIVÅ</span>
            <strong>{level}</strong>
          </div>
          <div className="scan-total">
            <b>{scans}</b>
            <span>SKANNINGAR · {(totalXp || 0).toLocaleString("sv-SE")} XP</span>
          </div>
          <div className="projector-bar">
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="bar-meta">
            <b>{pct}% MOT NÄSTA NIVÅ</b>
            <span>
              {next
                ? `${Math.max(0, next.at - current).toLocaleString("sv-SE")} ${unit.toUpperCase()} KVAR TILL ${next.title.toUpperCase()}`
                : "ALLT UPPLÅST"}
            </span>
          </div>
          <div className="unlock-row">
            {(community?.unlocks || []).slice(-3).map((u) => (
              <span key={`${u.questId}-${u.at}`} className={u.unlocked ? "done" : ""}>
                {u.unlocked ? "✓ " : ""}
                {u.at.toLocaleString("sv-SE")} {u.metric === "xp" ? "XP" : ""} {u.title.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section className="live-flash">
        <span>JUST NU</span>
        <p key={slide}>{messages[slide % messages.length]}</p>
        <div className="flash-dots">
          {messages.map((_, i) => (
            <i key={i} className={i === slide % messages.length ? "active" : ""} />
          ))}
        </div>
      </section>
      <footer>
        <span>SKANNA · SAMARBETA · LÅS UPP</span>
        <b>GOOD GAME LAN · PARKADEN</b>
        <span>UPPDATERAS VAR 3:E SEKUND</span>
      </footer>
    </main>
  );
}
