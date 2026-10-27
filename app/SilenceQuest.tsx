"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import QuestLobby from "./QuestLobby";
import { SILENCE_CLUES } from "@/lib/types";
import type { QuestLobby as Lobby } from "@/lib/types";

type Props = {
  onClose: () => void;
  onComplete: () => void;
};

type Phase = "lobby" | "starting" | "running" | "failed" | "done" | "error";

export default function SilenceQuest({ onClose, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [clue, setClue] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [level, setLevel] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef<number | undefined>(undefined);
  const lastStrike = useRef(0);
  const active = useRef(false);
  const startedRef = useRef(false);

  const stop = () => {
    active.current = false;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);
  };

  const startMic = async () => {
    stop();
    setPhase("starting");
    setStrikes(0);
    setLevel(0);
    setAnswer("");
    setWrong(false);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const context = new AudioContext();
      const source = context.createMediaStreamSource(media);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      active.current = true;
      setPhase("running");
      const measure = () => {
        if (!active.current) return;
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const next = Math.min(100, Math.round(avg * 2.2));
        setLevel(next);
        if (next > 34 && Date.now() - lastStrike.current > 1100) {
          lastStrike.current = Date.now();
          setStrikes((s) => {
            const value = s + 1;
            if (value >= 4) {
              stop();
              setPhase("failed");
            }
            return value;
          });
        }
        if (active.current) frame.current = requestAnimationFrame(measure);
      };
      measure();
    } catch {
      setPhase("error");
    }
  };

  useEffect(() => () => stop(), []);

  const onLobbyStarted = (lobby: Lobby, mySlot: number) => {
    if (startedRef.current) return;
    startedRef.current = true;
    const idx = mySlot % SILENCE_CLUES.length;
    setClue(SILENCE_CLUES[idx]);
    const partner =
      lobby.members.find((m) => (lobby.assignments?.[m.token] ?? m.slot) !== mySlot) ||
      lobby.members.find((_, i) => i !== mySlot);
    setPartnerName(partner?.name || "din lagkamrat");
    void startMic();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const normalized = answer.trim().toUpperCase().replaceAll(" ", "");
    if (normalized === "BLÅ7" || normalized === "BLA7") {
      stop();
      setPhase("done");
      onComplete();
    } else setWrong(true);
  };

  const close = () => {
    stop();
    onClose();
  };

  if (phase === "lobby") {
    return (
      <QuestLobby
        questId={5}
        questTitle="Tyst kommunikation"
        questType="LAG"
        requiredPlayers={2}
        onClose={onClose}
        onStarted={onLobbyStarted}
      />
    );
  }

  return (
    <div className="modal-backdrop">
      <section className="silence-modal locked">
        <button className="close" onClick={close}>
          ×
        </button>
        <p className="eyebrow">LAGUPPDRAG · TYST KOMMUNIKATION</p>

        {phase === "starting" && (
          <div className="mic-starting">
            <div className="nfc-pulse">◉</div>
            <h2>Mikrofonen startar…</h2>
            <p>Din unika ledtråd visas först när ljudkontrollen är aktiv.</p>
          </div>
        )}

        {phase === "running" && (
          <>
            <h2>Klura utan ett ord.</h2>
            <div className="clue-card live-clue">
              <small>DIN DEL AV LEDTRÅDEN · VISA INTE</small>
              <strong>{clue}</strong>
            </div>
            <p className="partner-note">
              {partnerName} har den andra delen. Kombinera delarna och skriv in lösningen – utan
              att prata.
            </p>
            <div className="live-audio">
              <div className={`mic-dot ${level > 34 ? "loud" : ""}`}>◉</div>
              <div>
                <b>{level > 34 ? "FÖR HÖGT!" : "MIKROFONEN LYSSNAR"}</b>
                <div className="meter">
                  <i style={{ width: `${level}%` }} />
                </div>
              </div>
            </div>
            <div className="strike-row">
              {[0, 1, 2, 3].map((i) => (
                <i key={i} className={i < strikes ? "hit" : ""}>
                  !
                </i>
              ))}
            </div>
            <small className="strike-help">Fyra ljudvarningar avbryter uppdraget</small>
            <form className="silent-answer" onSubmit={submit}>
              <label htmlFor="silent-code">LAGETS SVAR</label>
              <input
                id="silent-code"
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  setWrong(false);
                }}
                placeholder="Skriv lösningen här"
                autoComplete="off"
              />
              <button className="primary full" type="submit" disabled={!answer.trim()}>
                LÅS SVARET
              </button>
            </form>
            {wrong && (
              <p className="error-note">
                Det är inte rätt lösning. Fortsätt klura – och håll er tysta.
              </p>
            )}
          </>
        )}

        {phase === "failed" && (
          <>
            <div className="result-mark warn">!</div>
            <h2>För mycket ljud</h2>
            <p>Fyra ljudvarningar registrerades. Försöket avbröts och ledtråden låstes.</p>
            <button className="primary full" onClick={startMic}>
              STARTA OM FRÅN BÖRJAN
            </button>
          </>
        )}

        {phase === "done" && (
          <>
            <div className="result-mark success">✓</div>
            <h2>Rätt svar!</h2>
            <p>Ni kombinerade ledtrådarna och löste uppdraget utan att prata.</p>
            <button className="primary full" onClick={close}>
              KLART · STÄNG
            </button>
          </>
        )}

        {phase === "error" && (
          <>
            <div className="result-mark warn">!</div>
            <h2>Mikrofonen är inte tillgänglig</h2>
            <p>Ledtråden förblir dold tills mikrofonen är aktiv.</p>
            <button className="ghost full" onClick={startMic}>
              FÖRSÖK IGEN
            </button>
          </>
        )}
      </section>
    </div>
  );
}
