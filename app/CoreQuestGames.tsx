"use client";

import { useEffect, useRef, useState } from "react";
import QuestLobby from "./QuestLobby";
import { SYNC_NODE_ROLES } from "@/lib/types";
import type { QuestLobby as Lobby } from "@/lib/types";

type Props = {
  questId: number;
  simulateNfc?: boolean;
  onClose: () => void;
  onComplete: () => void;
};

const titles: Record<number, string> = {
  1: "Den försvunna signalen",
  2: "Synkronisera nätverket",
  3: "Pixeljägaren",
  4: "Boss raid: Blackout",
};
const BOSS_CELLS = ["tag-007", "tag-006", "tag-008"];
const routes: Record<number, string> = {
  1: "Rörlig ledartagg · nedre foajén / övre foajén / Skeppet",
  2: "Kapphängningen → fejkade eldstaden → TV-spelen under läktaren",
  3: "Huvudentrén utomhus → soffgruppen i nedre foajén",
  4: "Sällskapsspelen vid gradängen → TV-hörnan → scenens publika sida",
};

export default function CoreQuestGames({
  questId,
  simulateNfc = true,
  onClose,
  onComplete,
}: Props) {
  const needsLobby = questId === 2;
  const [lobbyDone, setLobbyDone] = useState(!needsLobby);
  const [lobbyId, setLobbyId] = useState("");
  const [mySlot, setMySlot] = useState(0);
  const [teammates, setTeammates] = useState<string[]>([]);
  const [stage, setStage] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(10);
  const [scans, setScans] = useState([false, false, false]);
  const [cells, setCells] = useState([false, false, false]);
  const [scannedTags, setScannedTags] = useState<string[]>([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [windowEndsAt, setWindowEndsAt] = useState<number | null>(null);
  const [syncNote, setSyncNote] = useState("");

  useEffect(() => {
    if (simulateNfc || (questId !== 1 && questId !== 3 && questId !== 4)) return;
    const load = () => {
      fetch(`/api/quest-progress?questId=${questId}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          const ids = ((d.scans || []) as { tagId: string }[]).map((s) => s.tagId);
          setScannedTags(ids);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [questId, simulateNfc]);

  useEffect(() => {
    if (simulateNfc || questId !== 1 || stage !== 1) return;
    if (scannedTags.includes("tag-010")) setStage(2);
  }, [simulateNfc, questId, stage, scannedTags]);

  useEffect(() => {
    if (simulateNfc || questId !== 3 || stage !== 0) return;
    if (scannedTags.includes("tag-009")) setStage(1);
  }, [simulateNfc, questId, stage, scannedTags]);

  useEffect(() => {
    if (simulateNfc || questId !== 4) return;
    setCells(BOSS_CELLS.map((id) => scannedTags.includes(id)));
  }, [simulateNfc, questId, scannedTags]);

  const finishedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (questId !== 2 || !windowEndsAt || done) return;
    const tick = () => setCount(Math.max(0, Math.ceil((windowEndsAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [questId, windowEndsAt, done]);

  useEffect(() => {
    if (questId !== 2 || !lobbyId || done) return;
    const poll = async () => {
      const r = await fetch(`/api/quest-lobby?lobbyId=${lobbyId}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      const shared = (d.lobby?.scans as boolean[]) || [];
      const ends = d.lobby?.windowEndsAt ? new Date(d.lobby.windowEndsAt).getTime() : 0;
      if (shared.length) {
        setScans([Boolean(shared[0]), Boolean(shared[1]), Boolean(shared[2])]);
        if (shared.every(Boolean) && !finishedRef.current) {
          finishedRef.current = true;
          setDone(true);
          onCompleteRef.current();
        }
      }
      if (ends) {
        setWindowEndsAt(ends);
        if (ends > Date.now()) setStage(1);
      }
    };
    poll();
    const t = setInterval(poll, 1000);
    return () => clearInterval(t);
  }, [questId, lobbyId, done]);

  const openWindow = async () => {
    if (!lobbyId || scanBusy) return;
    setScanBusy(true);
    setSyncNote("");
    try {
      const r = await fetch("/api/quest-lobby", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "window", lobbyId }),
      });
      const d = await r.json();
      if (!r.ok) {
        setSyncNote(d.error || "Kunde inte starta fönstret.");
        return;
      }
      const ends = d.lobby?.windowEndsAt ? new Date(d.lobby.windowEndsAt).getTime() : 0;
      if (ends) setWindowEndsAt(ends);
      const shared = (d.lobby?.scans as boolean[]) || [false, false, false];
      setScans([Boolean(shared[0]), Boolean(shared[1]), Boolean(shared[2])]);
      setStage(1);
    } finally {
      setScanBusy(false);
    }
  };

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setDone(true);
    onComplete();
  };
  const scanNode = async (i: number) => {
    if (count <= 0 || i !== mySlot || scanBusy || !lobbyId) return;
    setScanBusy(true);
    setSyncNote("");
    try {
      const r = await fetch("/api/quest-lobby", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "scan", lobbyId, slot: i }),
      });
      const d = await r.json();
      if (!r.ok) {
        setSyncNote(d.error || "Skanningen registrerades inte.");
        return;
      }
      if (d.lobby?.scans) {
        const shared = d.lobby.scans as boolean[];
        setScans([Boolean(shared[0]), Boolean(shared[1]), Boolean(shared[2])]);
        if (d.complete) finish();
      }
    } finally {
      setScanBusy(false);
    }
  };

  const onLobbyStarted = (lobby: Lobby, slot: number) => {
    setLobbyId(lobby.id);
    setMySlot(slot);
    setTeammates(lobby.members.filter((_, i) => i !== slot).map((m) => m.name));
    setLobbyDone(true);
  };

  if (needsLobby && !lobbyDone) {
    return (
      <QuestLobby
        questId={2}
        questTitle={titles[2]}
        questType="LAG"
        requiredPlayers={3}
        onClose={onClose}
        onStarted={onLobbyStarted}
      />
    );
  }

  return (
    <div className="modal-backdrop">
      <section className="core-game">
        <button className="close" onClick={onClose}>
          ×
        </button>
        <div className="mission-bar">
          <span>AKTIVT UPPDRAG</span>
          <b>+{[250, 600, 180, 1200][questId - 1]} Chip</b>
        </div>
        <h2>{titles[questId]}</h2>
        <div className="route-banner">
          <small>UPPDRAGSRUTT</small>
          <b>{routes[questId]}</b>
          <span>
            Endast publika ytor. Sovsalar, toaletter, kök, kontor och teknik/admin är förbjudna.
          </span>
        </div>
        {done ? (
          <div className="game-result">
            <div className="result-mark success">✓</div>
            <h3>Uppdrag slutfört!</h3>
            <p>Resultatet är registrerat. Du kan nu återvända till uppdragslistan.</p>
            <button className="primary full" onClick={onClose}>
              CHIP REGISTRERAT · STÄNG
            </button>
          </div>
        ) : (
          <>
            {questId === 1 && (
              <div className="core-body">
                {stage === 0 && (
                  <>
                    <div className="clue-screen">
                      <small>VANDRANDE LEDTRÅD</small>
                      <p>
                        ”Jag hjälper spelare men sitter sällan själv vid en station. Signalen följer
                        mig mellan foajéerna och Skeppet.”
                      </p>
                    </div>
                    <div className="objective">
                      <b>DITT MÅL</b>
                      <span>
                        Hitta ledaren som just nu bär signalbrickan på sitt nyckelband. Fråga inte
                        vem det är – använd ledtråden och håll utkik i de publika zonerna.
                      </span>
                    </div>
                    <button className="primary full" onClick={() => setStage(1)}>
                      JAG HAR HITTAT BÄRAREN
                    </button>
                  </>
                )}
                {stage === 1 && (
                  <>
                    <div className="nfc-pulse">⌁</div>
                    <h3>Skanna den vandrande noden</h3>
                    <p>
                      Håll mobilen mot NFC-taggen på ledarens nyckelband. Taggen kan lämnas vidare
                      efter din skanning.
                    </p>
                    {simulateNfc ? (
                      <button className="primary full" onClick={() => setStage(2)}>
                        ⌁ SIMULERA LEDARTAGG
                      </button>
                    ) : (
                      <p className="objective">
                        <b>NFC KRÄVS</b>
                        <span>
                          Håll mobilen mot taggen på ledarens nyckelband. Steget låses upp när
                          skanningen är registrerad.
                        </span>
                      </p>
                    )}
                  </>
                )}
                {stage === 2 && (
                  <>
                    <div className="transmission">
                      <small>AVKODAD SÄNDNING</small>
                      <strong>16 · 1 · 18 · 11</strong>
                    </div>
                    <p>Varje tal motsvarar en bokstav i alfabetet. Vilket ord bildas?</p>
                    <div className="answer-grid">
                      {["PORT", "PARK", "KODX", "LANK"].map((a) => (
                        <button key={a} onClick={() => (a === "PARK" ? finish() : setWrong(true))}>
                          {a}
                        </button>
                      ))}
                    </div>
                    {wrong && <p className="error-note">Fel kod. Tips: A = 1, B = 2, C = 3…</p>}
                  </>
                )}
              </div>
            )}

            {questId === 2 && (
              <div className="core-body">
                {stage === 0 && (
                  <>
                    <div className="objective">
                      <b>DIN NOD</b>
                      <span>
                        Du skannar bara <strong>{SYNC_NODE_ROLES[mySlot]}</strong>. Lagkamrater:{" "}
                        {teammates.join(", ") || "—"}. När alla är på plats – starta fönstret. Alla
                        tre noder måste skannas inom 10 sekunder.
                      </span>
                    </div>
                    <button className="primary full" disabled={scanBusy} onClick={openWindow}>
                      {scanBusy ? "STARTAR…" : "STARTA 10 SEKUNDERS FÖNSTER"}
                    </button>
                    {syncNote && <p className="error-note">{syncNote}</p>}
                  </>
                )}
                {stage === 1 && (
                  <>
                    <div className={`sync-clock ${count <= 3 ? "danger" : ""}`}>{count}</div>
                    <p>
                      Din knapp: nod {mySlot + 1} · {SYNC_NODE_ROLES[mySlot]}
                    </p>
                    <div className="sync-nodes">
                      {scans.map((s, i) => (
                        <button
                          key={i}
                          disabled={s || count <= 0 || i !== mySlot}
                          className={s ? "scanned" : i === mySlot ? "" : "locked-node"}
                          onClick={() => scanNode(i)}
                        >
                          ⌁
                          <small>
                            NOD {i + 1}
                            {i === mySlot ? " · DU" : ""}
                          </small>
                        </button>
                      ))}
                    </div>
                    {syncNote && <p className="error-note">{syncNote}</p>}
                    {count <= 0 && (
                      <>
                        <p className="error-note">Tiden gick ut. Samla gruppen och försök igen.</p>
                        <button className="ghost full" disabled={scanBusy} onClick={openWindow}>
                          BÖRJA OM
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {questId === 3 && (
              <div className="core-body">
                {stage === 0 && (
                  <>
                    <div className="pixel-clue">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <p>Symbolen ovan finns gömd nära entrén. Hitta motsvarande NFC-bricka.</p>
                    {simulateNfc ? (
                      <button className="primary full" onClick={() => setStage(1)}>
                        ⌁ JAG HAR HITTAT BRICKAN
                      </button>
                    ) : (
                      <p className="objective">
                        <b>NFC KRÄVS</b>
                        <span>
                          Skanna pixelsymbolens bricka vid entrén. Gåtan öppnas när signalen är
                          registrerad.
                        </span>
                      </p>
                    )}
                  </>
                )}
                {stage === 1 && (
                  <>
                    <h3>Vilken pixelväg är säker?</h3>
                    <p>Följ endast rutor som delar kant – aldrig hörn.</p>
                    <div className="path-options">
                      <button onClick={() => setWrong(true)}>A · ↘ ↘ →</button>
                      <button onClick={finish}>B · → ↓ →</button>
                      <button onClick={() => setWrong(true)}>C · ↓ ↗ ↓</button>
                    </div>
                    {wrong && (
                      <p className="error-note">
                        Glitch! Diagonala hopp räknas inte. Försök igen.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {questId === 4 && (
              <div className="core-body">
                <div className="raid-status">
                  <span>LIVE EVENT</span>
                  <b>18/20 spelare anslutna</b>
                </div>
                <p>Tre energiceller måste aktiveras innan laget kan kombinera slutkoden.</p>
                <div className="energy-cells">
                  {cells.map((c, i) => (
                    <button
                      key={i}
                      className={c ? "on" : ""}
                      disabled={!simulateNfc}
                      onClick={() => {
                        if (!simulateNfc) return;
                        setCells(cells.map((v, n) => (n === i ? true : v)));
                      }}
                    >
                      <span>{c ? "⚡" : "○"}</span>
                      <b>CELL {i + 1}</b>
                      <small>
                        {c ? "AKTIVERAD" : simulateNfc ? "TRYCK FÖR NFC" : "SKANNA BRICKAN"}
                      </small>
                    </button>
                  ))}
                </div>
                {cells.every(Boolean) && (
                  <>
                    <div className="boss-code">
                      <small>KODERNA BILDAR</small>
                      <strong>G · G · 7</strong>
                    </div>
                    <p>Välj rätt slutkod för att återställa Parkadens nätverk.</p>
                    <div className="answer-grid">
                      <button onClick={() => setWrong(true)}>G7G</button>
                      <button onClick={finish}>GG7</button>
                      <button onClick={() => setWrong(true)}>7GG</button>
                    </div>
                    {wrong && (
                      <p className="error-note">
                        Bossen blockerade koden. Läs cellerna från vänster till höger.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
