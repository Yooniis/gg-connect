"use client";

import { useEffect, useRef, useState } from "react";
import QuestGames from "./QuestGames";
import CoreQuestGames from "./CoreQuestGames";
import QuestRunner from "./QuestRunner";
import MicGate from "./MicGate";
import SilenceQuest from "./SilenceQuest";
import LiveQuestFeed from "./LiveQuestFeed";
import LiveCommunity from "./LiveCommunity";
import PlayerXP from "./PlayerXP";
import { acceptQuest as persistAcceptance, awardQuest } from "./game-progress";
import XpAwardToast from "./XpAwardToast";
import CompletionLock from "./CompletionLock";
import PlayerOnboarding from "./PlayerOnboarding";
import { getPlayer } from "./player-session";

type Tag = { id: string; name: string; stationKey: string; location: string };
type PuzzleStep = {
  id: string;
  type: "code" | "text" | "choice";
  prompt: string;
  choices?: { id: string; label: string }[];
  tagId?: string | null;
};
type UnlockRule = {
  questId: number;
  title: string;
  metric: "scans" | "xp" | "none";
  at: number;
  unlocked?: boolean;
  current?: number;
  unit?: string;
};
type Quest = {
  id: number;
  type: "SOLO" | "LAG" | "EVENT" | string;
  title: string;
  place: string;
  time?: string;
  xp: number;
  people?: string;
  accent?: string;
  icon?: string;
  description: string;
  steps: string[];
  puzzleSteps?: PuzzleStep[];
  tagIds?: string[];
  tags?: Tag[];
  requireScan?: boolean;
  gameMode?: string | null;
  unlocked?: boolean;
  scheduleOk?: boolean;
  scheduleError?: string | null;
  unlockRule?: UnlockRule | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

const ACCENTS = ["violet", "cyan", "pink", "amber", "green", "orange", "yellow", "red"];
const ICONS = ["⌁", "⌘", "◇", "⚡", "◉", "⇥", "▦", "△", "?", "◎"];

const ideas = [
  ["Stafett", "Nästa NFC avslöjas först när lagkamraten klarat sin del."],
  ["Tyst kommunikation", "Två spelare får varsin halva av en gåta och får inte prata."],
  ["Minnesglitch", "Se en sekvens i fem sekunder – återskapa den vid nästa station."],
  ["Falsk nod", "Tre brickor ger ledtrådar, men en av dem ljuger."],
  ["Hemlig agent", "En spelare får ett dolt sidouppdrag mitt under lagets quest."],
  ["Community unlock", "Alla deltagares skanningar fyller en gemensam energimätare."],
];

function decorate(q: Quest, index: number): Quest {
  return {
    ...q,
    accent: q.accent || ACCENTS[index % ACCENTS.length],
    icon: q.icon || ICONS[index % ICONS.length],
    time: q.time || (q.startsAt ? new Date(q.startsAt).toLocaleString("sv-SE") : "Öppen"),
    steps: Array.isArray(q.steps) ? q.steps : [],
  };
}

export default function Home() {
  const [tab, setTab] = useState<"quests" | "map">("quests");
  const [filter, setFilter] = useState("ALLA");
  const [quests, setQuests] = useState<Quest[]>([]);
  const [selected, setSelected] = useState<Quest | null>(null);
  const [joined, setJoined] = useState<number[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [silenceOpen, setSilenceOpen] = useState(false);
  const [simulateNfc, setSimulateNfc] = useState(true);
  const [communityScans, setCommunityScans] = useState(0);
  const [communityXp, setCommunityXp] = useState(0);
  const [micState, setMicState] = useState<"ready" | "running" | "done" | "error">("ready");
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(30);
  const [warnings, setWarnings] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const lastNoiseRef = useRef(0);

  const loadQuests = () =>
    fetch("/api/quests", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setQuests((d.quests || []).map((q: Quest, i: number) => decorate(q, i)));
        setSimulateNfc(d.settings?.simulateNfcEnabled !== false);
        setCommunityScans(d.community?.scans || 0);
        setCommunityXp(d.community?.totalXp || 0);
      })
      .catch(() => {});

  useEffect(() => {
    loadQuests();
    const onScan = () => loadQuests();
    window.addEventListener("community-scan", onScan);
    return () => window.removeEventListener("community-scan", onScan);
  }, []);

  const visible = quests.filter((q) => filter === "ALLA" || q.type === filter);
  const stopMic = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };
  useEffect(() => () => stopMic(), []);
  useEffect(() => {
    if (micState !== "running") return;
    const timer = window.setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [micState]);
  useEffect(() => {
    if (seconds <= 0 && micState === "running") {
      stopMic();
      setMicState("done");
    }
  }, [seconds, micState]);

  const startSilence = async () => {
    try {
      stopMic();
      setSeconds(30);
      setWarnings(0);
      setLevel(0);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      setMicState("running");
      const measure = () => {
        analyser.getByteFrequencyData(data);
        const average = data.reduce((a, b) => a + b, 0) / data.length;
        const next = Math.min(100, Math.round(average * 2.2));
        setLevel(next);
        if (next > 34 && Date.now() - lastNoiseRef.current > 1100) {
          setWarnings((w) => w + 1);
          lastNoiseRef.current = Date.now();
        }
        rafRef.current = requestAnimationFrame(measure);
      };
      measure();
    } catch {
      setMicState("error");
    }
  };
  const closeSilence = () => {
    stopMic();
    setSilenceOpen(false);
    setMicState("ready");
  };

  const lockLabel = (q: Quest) => {
    const rule = q.unlockRule;
    if (!rule || rule.metric === "none") return null;
    const current = rule.metric === "xp" ? communityXp : communityScans;
    const left = Math.max(0, rule.at - current);
    const unit = rule.metric === "xp" ? "XP" : "skanningar";
    return { left, unit, at: rule.at, title: rule.title };
  };

  const acceptQuest = async (q: Quest) => {
    const result = await persistAcceptance(q);
    if (!result?.accepted) {
      if (result?.error) window.alert(result.error);
      return;
    }
    setJoined((c) => (c.includes(q.id) ? c : [...c, q.id]));
    if (q.gameMode === "silence" || q.id === 5) {
      setSelected(null);
      setSilenceOpen(true);
    }
  };

  const activeGame =
    selected && joined.includes(selected.id)
      ? selected.gameMode === "silence" || selected.id === 5
        ? null
        : selected.gameMode === "builtin" && selected.id <= 4
          ? "core"
          : selected.gameMode === "builtin" && selected.id >= 6
            ? "legacy"
            : "custom"
      : null;

  return (
    <main>
      <div className="noise" />
      <header className="topbar">
        <div className="brand">
          <span className="brandmark">GG</span>
          <span>
            GOOD GAME <b>QUEST</b>
          </span>
        </div>
        <div className="live">
          <i /> LIVE · PARKADEN
        </div>
        <button className="avatar" aria-label="Öppna profil">
          B
        </button>
      </header>
      <div className="shell">
        <PlayerOnboarding />
        <section className="status-card">
          <div>
            <p className="eyebrow">HÖSTLOVET · HÄRNÖSAND</p>
            <h1>
              Parkaden är
              <br />
              <em>spelplanen.</em>
            </h1>
            <p className="lead">Hitta signaler. Hjälp communityn. Jaga XP-toppen.</p>
          </div>
          <PlayerXP />
        </section>
        <LiveCommunity />
        <CompletionLock />
        <nav className="tabs" aria-label="Huvudnavigering">
          <button className={tab === "quests" ? "active" : ""} onClick={() => setTab("quests")}>
            Uppdrag <span>{quests.length}</span>
          </button>
          <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}>
            Zoner
          </button>
        </nav>
        {tab === "quests" && (
          <>
            <div className="section-head">
              <div>
                <p className="eyebrow">TILLGÄNGLIGA NU</p>
                <h2>Välj nästa quest</h2>
              </div>
              <div className="filters">
                {["ALLA", "SOLO", "LAG", "EVENT"].map((f) => (
                  <button
                    key={f}
                    className={filter === f ? "active" : ""}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <section className="quest-grid">
              {visible.map((q) => {
                const lock = !q.unlocked ? lockLabel(q) : null;
                const locked = Boolean(lock) || q.unlocked === false;
                const scheduleBlocked = q.scheduleOk === false;
                return (
                  <article
                    className={`quest ${q.accent} ${locked || scheduleBlocked ? "community-locked" : ""}`}
                    key={q.id}
                    onClick={() => {
                      if (q.id === 10) {
                        document.getElementById("community-core")?.scrollIntoView({
                          behavior: "smooth",
                        });
                        return;
                      }
                      if (!locked && !scheduleBlocked) setSelected(q);
                    }}
                  >
                    <div className="quest-top">
                      <span className="quest-icon">{locked || scheduleBlocked ? "◈" : q.icon}</span>
                      <span className="tag">{q.type}</span>
                    </div>
                    <h3>{q.title}</h3>
                    <p>
                      {scheduleBlocked
                        ? q.scheduleError
                        : locked && lock
                          ? `Hela LAN:et behöver nå ${lock.at.toLocaleString("sv-SE")} ${lock.unit} för att låsa upp uppdraget.`
                          : q.description}
                    </p>
                    <div className="quest-meta">
                      <span>⌖ {locked ? "Platsen avslöjas vid upplåsning" : q.place}</span>
                      <span>◷ {q.time}</span>
                      {q.people && <span>♟ {q.people}</span>}
                    </div>
                    <footer>
                      <b>
                        {locked && lock
                          ? `${lock.left.toLocaleString("sv-SE")} ${lock.unit} kvar`
                          : `+${q.xp} XP`}
                      </b>
                      <span>
                        {scheduleBlocked
                          ? "UTANFÖR SCHEMA"
                          : locked && lock
                            ? `LÅSES VID ${lock.at.toLocaleString("sv-SE")}`
                            : q.id === 10
                              ? "VISA COMMUNITY CORE ↑"
                              : joined.includes(q.id)
                                ? "ANTAGET ✓"
                                : "VISA UPPDRAG →"}
                      </span>
                    </footer>
                  </article>
                );
              })}
            </section>
            <section className="idea-section">
              <p className="eyebrow">FLER SPELMEKANIKER</p>
              <h2>Quest-idéer för hela byggnaden</h2>
              <div className="idea-grid">
                {ideas.map(([title, text], i) => (
                  <article key={title}>
                    <span>0{i + 1}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
        {tab === "map" && (
          <section className="panel map-panel">
            <div>
              <p className="eyebrow">SPELZONER</p>
              <h2>Parkadens spelkarta</h2>
              <p>
                Exakta NFC-positioner avslöjas först i ett aktivt uppdrag. Den vandrande noden kan
                byta ledare och röra sig mellan alla publika zoner.
              </p>
              <div className="venue-restricted">
                FREDADE YTOR: sovsalar, toaletter, kök, matsal när den är stängd, låst kontor samt
                allt vid teknikbord, huvudrouter och admin.
              </div>
            </div>
            <div className="venue-map">
              <div className="venue-zone">
                <b>UTOMHUS</b>
                <span>Entrén och byggnadens närmaste säkra fasadsida.</span>
              </div>
              <div className="venue-zone">
                <b>NEDRE FOAJÉ</b>
                <span>Kapphängning och soffgrupp. Inga stationer inne på toaletter eller i sovsal.</span>
              </div>
              <div className="venue-zone">
                <b>ÖVRE FOAJÉ</b>
                <span>Ståbord, fejkad eldstad och soffornas hängyta.</span>
              </div>
              <div className="venue-zone">
                <b>SKEPPET</b>
                <span>
                  Gradäng, kafé-/sällskapsspel, scenens publika sida, TV-hörna och TV-spel under
                  läktaren.
                </span>
              </div>
              <div className="venue-zone mobile">
                <b>VANDRANDE NOD</b>
                <span>NFC-taggen sitter på en ledare och kan lämnas vidare under kvällen.</span>
              </div>
            </div>
          </section>
        )}
      </div>
      <div className="dynamic-feed-wrap">
        <LiveQuestFeed />
      </div>
      <button className="scan-button" onClick={() => setScanOpen(true)}>
        <span>⌁</span> SKANNA NFC
      </button>

      {activeGame === "core" && selected && (
        <CoreQuestGames
          questId={selected.id}
          onClose={() => setSelected(null)}
          onComplete={() => {
            setJoined((c) => (c.includes(selected.id) ? c : [...c, selected.id]));
            awardQuest(selected, { skipPuzzleCheck: true });
          }}
        />
      )}
      {activeGame === "legacy" && selected && (
        <QuestGames
          questId={selected.id}
          onClose={() => setSelected(null)}
          onComplete={() => {
            setJoined((c) => (c.includes(selected.id) ? c : [...c, selected.id]));
            awardQuest(selected, { skipPuzzleCheck: true });
          }}
        />
      )}
      {activeGame === "custom" && selected && (
        <QuestRunner
          quest={selected}
          simulateNfcEnabled={simulateNfc}
          onClose={() => setSelected(null)}
          onComplete={() => setJoined((c) => (c.includes(selected.id) ? c : [...c, selected.id]))}
        />
      )}

      {selected && !joined.includes(selected.id) && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className={`modal ${selected.accent}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close" onClick={() => setSelected(null)}>
              ×
            </button>
            <span className="quest-icon large">{selected.icon}</span>
            <p className="eyebrow">
              {selected.type} QUEST · {selected.xp} GRUND-XP + TIDSBONUS
            </p>
            <h2>{selected.title}</h2>
            <p>{selected.description}</p>
            <ol>
              {(selected.steps || []).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {(selected.tags || []).length > 0 && (
              <div className="time-xp-note">
                <b>⌁ {(selected.tags || []).length} NFC-TAGGAR</b>
                <span>
                  {(selected.tags || []).map((t) => t.name).join(" · ")}
                </span>
              </div>
            )}
            <div className="time-xp-note">
              <b>⏱ TIDEN STARTAR NÄR DU ANTAR</b>
              <span>
                Snabbare lösning ger upp till 50 % extra XP. Du behåller alltid uppdragets
                grundpoäng.
              </span>
            </div>
            <button className="primary full" onClick={() => acceptQuest(selected)}>
              {selected.gameMode === "silence" || selected.id === 5
                ? "ANTA & STARTA TYSTNADSUPPDRAG"
                : "ANTA & STARTA TIDEN"}
            </button>
          </section>
        </div>
      )}

      <XpAwardToast />
      <MicGate />
      {silenceOpen && (
        <SilenceQuest
          onClose={closeSilence}
          onComplete={() => {
            const q = quests.find((x) => x.id === 5) || {
              id: 5,
              title: "Tyst kommunikation",
              xp: 450,
            };
            setJoined((c) => (c.includes(5) ? c : [...c, 5]));
            awardQuest(q, { skipPuzzleCheck: true });
          }}
        />
      )}
      {scanOpen && (
        <div className="modal-backdrop" onClick={() => setScanOpen(false)}>
          <section className="scan-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setScanOpen(false)}>
              ×
            </button>
            <div className="scan-rings">
              <span>⌁</span>
            </div>
            <p className="eyebrow">NFC-LÄSARE REDO</p>
            <h2>Håll mobilen mot brickan</h2>
            <p>På en riktig station öppnas rätt quest direkt via brickans unika webblänk.</p>
            {simulateNfc ? (
              <button
                className="ghost"
                onClick={async () => {
                  const player = getPlayer();
                  if (!player) {
                    window.dispatchEvent(new Event("open-player-profile"));
                    return;
                  }
                  await fetch("/api/community", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      playerName: player.name,
                      stationKey: `sim-${Date.now()}`,
                      xpGain: 20,
                    }),
                  });
                  window.dispatchEvent(new Event("community-scan"));
                  window.dispatchEvent(new Event("progress-updated"));
                  setScanOpen(false);
                }}
              >
                SIMULERA SKANNING · +20 XP
              </button>
            ) : (
              <p className="error-note">NFC-simulering är avstängd av admin.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
