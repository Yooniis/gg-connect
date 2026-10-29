"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { awardQuest } from "./game-progress";
import { getPlayer } from "./player-session";
import { clockMask, formatClockAnswer } from "@/lib/types";

type Tag = { id: string; name: string; stationKey: string; location: string };
type PuzzleStep = {
  id: string;
  type: "code" | "text" | "choice" | "time";
  prompt: string;
  choices?: { id: string; label: string }[];
  tagId?: string | null;
};
type Quest = {
  id: number;
  title: string;
  xp: number;
  tagIds?: string[];
  requireScan?: boolean;
  tags?: Tag[];
  puzzleSteps?: PuzzleStep[];
  scanWindowSeconds?: number | null;
  scanInOrder?: boolean;
};

function formatLeft(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function ClockField({
  digits,
  onDigits,
}: {
  digits: string;
  onDigits: (next: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const shown = clockMask(digits);

  useEffect(() => {
    const node = ref.current;
    if (!node || document.activeElement !== node) return;
    const pos = digits.length < 2 ? digits.length : digits.length + 1;
    node.setSelectionRange(pos, pos);
  }, [digits]);

  const placeCaret = (node: HTMLInputElement) => {
    const pos = digits.length < 2 ? digits.length : digits.length + 1;
    node.setSelectionRange(pos, pos);
  };

  return (
    <label className="runner-input clock-field">
      Klockslag
      <input
        ref={ref}
        className="clock-input"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        aria-label="Klockslag"
        value={shown}
        onFocus={(e) => placeCaret(e.currentTarget)}
        onClick={(e) => placeCaret(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Backspace") {
            e.preventDefault();
            onDigits(digits.slice(0, -1));
            return;
          }
          if (/^\d$/.test(e.key)) {
            e.preventDefault();
            if (digits.length < 4) onDigits(digits + e.key);
          }
        }}
        onChange={(e) => {
          const raw = e.target.value;
          const next = raw.replace(/\D/g, "").slice(0, 4);
          if (next === digits && raw.length < shown.length) {
            onDigits(digits.slice(0, -1));
            return;
          }
          if (next !== digits) onDigits(next);
        }}
      />
    </label>
  );
}

type Props = {
  quest: Quest;
  onClose: () => void;
  onComplete: () => void;
};

export default function QuestRunner({
  quest,
  onClose,
  onComplete,
}: Props) {
  const required = (quest.tagIds?.length ? quest.tagIds : (quest.tags || []).map((t) => t.id))
    .map((id) => (quest.tags || []).find((t) => t.id === id))
    .filter((t): t is Tag => Boolean(t));
  const steps = quest.puzzleSteps || [];
  const windowSeconds = quest.scanWindowSeconds || 0;
  const [scanned, setScanned] = useState<string[]>([]);
  const [clues, setClues] = useState<{ tagId: string; text: string }[]>([]);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [phase, setPhase] = useState<"nfc" | "puzzle" | "confirm" | "done">(
    quest.requireScan !== false && required.length ? "nfc" : steps.length ? "puzzle" : "confirm",
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<{ stepId: string; answer: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [memoryReady, setMemoryReady] = useState(quest.id !== 7);

  const remaining = useMemo(
    () => required.filter((t) => !scanned.includes(t.id)),
    [required, scanned],
  );
  const visibleTags = quest.scanInOrder
    ? required.filter((tag, index) => {
        if (scanned.includes(tag.id)) return true;
        const prev = required[index - 1];
        return !prev || scanned.includes(prev.id);
      })
    : required;
  const left = windowSeconds
    ? acceptedAt
      ? windowSeconds - Math.floor((now - new Date(acceptedAt).getTime()) / 1000)
      : windowSeconds
    : null;
  const expired = left != null && left <= 0 && scanned.length < required.length;
  const current = steps[stepIndex];

  const applyProgress = (data: {
    scans?: { tagId: string }[];
    clues?: { tagId: string; text: string }[];
    acceptedAt?: string | null;
  }) => {
    const ids = (data.scans || []).map((s) => s.tagId);
    setScanned(ids);
    if (data.clues) setClues(data.clues);
    if (data.acceptedAt !== undefined) setAcceptedAt(data.acceptedAt);
    return ids;
  };

  useEffect(() => {
    if (!windowSeconds) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [windowSeconds]);

  useEffect(() => {
    if (quest.id !== 7 || phase !== "puzzle") return;
    setMemoryReady(false);
    const timer = window.setTimeout(() => setMemoryReady(true), 3500);
    return () => window.clearTimeout(timer);
  }, [quest.id, phase]);

  useEffect(() => {
    const player = getPlayer();
    if (!player) return;
    let stop = false;
    const load = () =>
      fetch(`/api/quest-progress?questId=${quest.id}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (stop) return;
          const ids = applyProgress(d);
          if (quest.requireScan !== false && required.length && ids.length < required.length) {
            setPhase("nfc");
          } else if (steps.length) {
            setPhase((p) => (p === "done" ? p : "puzzle"));
          } else {
            setPhase((p) => (p === "done" ? p : "confirm"));
          }
        })
        .catch(() => {});
    load();
    const timer = window.setInterval(load, 2000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [quest.id, quest.requireScan, required.length, steps.length]);

  const restartSprint = async () => {
    setBusy(true);
    setError("");
    const player = getPlayer();
    const r = await fetch("/api/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "accept",
        playerName: player?.name,
        questId: quest.id,
        questTitle: quest.title,
      }),
    });
    const data = await r.json();
    setBusy(false);
    if (!r.ok) {
      setError(data.error || "Kunde inte starta om.");
      return;
    }
    setScanned([]);
    setClues([]);
    setAcceptedAt(data.acceptance?.acceptedAt || new Date().toISOString());
    setPhase("nfc");
  };

  const submitStep = async () => {
    if (!current) return;
    if (current.tagId && !scanned.includes(current.tagId)) {
      setError("Skanna rätt NFC-tagg innan du svarar på detta steg.");
      return;
    }
    const value = current.type === "time" ? formatClockAnswer(answer) : answer.trim();
    if (!value) {
      setError(current.type === "time" ? "Skriv fyra siffror." : "Ange ett svar.");
      return;
    }
    const nextAnswers = [
      ...answers.filter((a) => a.stepId !== current.id),
      { stepId: current.id, answer: value },
    ];
    setAnswers(nextAnswers);
    setAnswer("");
    setError("");
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    await finish(nextAnswers);
  };

  const finish = async (finalAnswers: { stepId: string; answer: string }[]) => {
    setBusy(true);
    setError("");
    const data = await awardQuest(
      { id: quest.id, title: quest.title, xp: quest.xp },
      { answers: finalAnswers },
    );
    setBusy(false);
    if (data?.error) {
      setError(data.error);
      const failed = steps.findIndex((s) => s.id === data.stepId);
      if (failed >= 0) {
        setPhase("puzzle");
        setStepIndex(failed);
      }
      return;
    }
    setPhase("done");
    onComplete();
  };

  return (
    <div className="modal-backdrop">
      <section className="game-modal quest-runner">
        <button className="close" onClick={onClose}>
          ×
        </button>
        <p className="eyebrow">LIVE UPPDRAG · NFC + PUSSEL</p>
        <h2>{quest.title}</h2>

        {phase === "nfc" && (
          <div className="game-body">
            <span className="game-kicker">
              SKANNA {scanned.length}/{required.length} TAGGAR
            </span>
            {left != null && (
              <p className={`sprint-clock ${expired ? "late" : ""}`} aria-live="polite">
                {formatLeft(left)}
              </p>
            )}
            <p>
              {quest.scanInOrder
                ? "Håll mobilen mot brickan. Nästa plats står på den du just skannade."
                : left != null
                  ? "Alla noder måste vara skannade innan klockan når noll. Ordningen är fri."
                  : "Håll mobilen mot brickan. Ledtråden dyker upp här när skanningen är registrerad."}
            </p>
            {clues.length > 0 && (
              <ul className="clue-list">
                {clues.map((c) => (
                  <li key={c.tagId}>{c.text}</li>
                ))}
              </ul>
            )}
            <div className="tag-scan-list">
              {visibleTags.map((tag) => {
                const ok = scanned.includes(tag.id);
                return (
                  <div key={tag.id} className={`tag-scan-row ${ok ? "done" : ""}`}>
                    <div>
                      <b>{tag.name}</b>
                      <small>
                        {tag.location || tag.stationKey}
                      </small>
                    </div>
                    {ok ? (
                      <em>✓ SKANNAD</em>
                    ) : (
                      <em>VÄNTAR</em>
                    )}
                  </div>
                );
              })}
            </div>
            {expired && (
              <button className="primary full" disabled={busy} onClick={restartSprint}>
                {busy ? "STARTAR OM…" : "STARTA OM SPRINTEN"}
              </button>
            )}
            {!expired && remaining.length > 0 && (
              <a className="ghost full" href="/scan" style={{ textDecoration: "none" }}>
                INGEN NFC? ANGE STATIONSKOD
              </a>
            )}
            {!remaining.length && !expired && (
              <button
                className="primary full"
                onClick={() => (steps.length ? setPhase("puzzle") : setPhase("confirm"))}
              >
                FORTSÄTT
              </button>
            )}
          </div>
        )}

        {phase === "puzzle" && current && quest.id === 7 && !memoryReady && (
          <div className="game-body">
            <span className="game-kicker">MEMORERA</span>
            <p>Sekvensen försvinner om en stund. Återskapa den sedan.</p>
            <div className="memory-grid">
              {["orange", "red", "yellow", "blue"].map((c) => (
                <button key={c} type="button" className={`${c} flash`} disabled aria-label={c} />
              ))}
            </div>
          </div>
        )}

        {phase === "puzzle" && current && (quest.id !== 7 || memoryReady) && (
          <div className="game-body">
            <span className="game-kicker">
              STEG {stepIndex + 1} AV {steps.length}
            </span>
            <h3>{current.prompt}</h3>
            {clues.length > 0 && (
              <ul className="clue-list">
                {clues.map((c) => (
                  <li key={c.tagId}>{c.text}</li>
                ))}
              </ul>
            )}
            {current.type === "time" ? (
              <ClockField digits={answer.replace(/\D/g, "").slice(0, 4)} onDigits={setAnswer} />
            ) : current.type === "choice" ? (
              <div className="answer-grid">
                {(current.choices || []).map((c) => (
                  <button
                    key={c.id}
                    className={answer === c.id ? "selected" : ""}
                    onClick={() => setAnswer(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            ) : (
              <label className="runner-input">
                {current.type === "code" ? "Kod" : "Svar"}
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={current.type === "code" ? "Ange kod" : "Skriv svaret"}
                  autoComplete="off"
                />
              </label>
            )}
            <button className="primary full" disabled={busy} onClick={submitStep}>
              {stepIndex < steps.length - 1 ? "NÄSTA STEG" : busy ? "SPARAR…" : "SLUTFÖR UPPDRAG"}
            </button>
          </div>
        )}

        {phase === "confirm" && (
          <div className="game-body">
            <h3>Bekräfta att uppdraget är klart</h3>
            <p>Chip registreras först när du bekräftar. Det går bara att hämta en gång.</p>
            <button className="primary full" disabled={busy} onClick={() => finish([])}>
              {busy ? "SPARAR…" : "SLUTFÖR UPPDRAG"}
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="game-result">
            <div className="result-mark success">✓</div>
            <h3>Uppdrag slutfört!</h3>
            <p>Din insats är registrerad och Chip har lagts till.</p>
            <button className="primary full" onClick={onClose}>
              TILLBAKA TILL UPPDRAG
            </button>
          </div>
        )}

        {error && <p className="error-note">{error}</p>}
      </section>
    </div>
  );
}
