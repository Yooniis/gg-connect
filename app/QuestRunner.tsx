"use client";

import { useEffect, useMemo, useState } from "react";
import { awardQuest } from "./game-progress";
import { getPlayer } from "./player-session";

type Tag = { id: string; name: string; stationKey: string; location: string };
type PuzzleStep = {
  id: string;
  type: "code" | "text" | "choice";
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
};

type Props = {
  quest: Quest;
  simulateNfcEnabled: boolean;
  onClose: () => void;
  onComplete: () => void;
};

export default function QuestRunner({
  quest,
  simulateNfcEnabled,
  onClose,
  onComplete,
}: Props) {
  const required = quest.tags || [];
  const steps = quest.puzzleSteps || [];
  const [scanned, setScanned] = useState<string[]>([]);
  const [phase, setPhase] = useState<"nfc" | "puzzle" | "done">(
    quest.requireScan !== false && required.length ? "nfc" : steps.length ? "puzzle" : "done",
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<{ stepId: string; answer: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const remaining = useMemo(
    () => required.filter((t) => !scanned.includes(t.id)),
    [required, scanned],
  );
  const current = steps[stepIndex];

  useEffect(() => {
    const player = getPlayer();
    if (!player) return;
    fetch(`/api/quest-progress?questId=${quest.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const ids = (d.scans || []).map((s: { tagId: string }) => s.tagId);
        setScanned(ids);
        if (quest.requireScan !== false && required.length && ids.length < required.length) {
          setPhase("nfc");
        } else if (steps.length) {
          setPhase("puzzle");
        } else {
          setPhase("done");
        }
      })
      .catch(() => {});
  }, [quest.id, quest.requireScan, required.length, steps.length]);

  const simulateTag = async (tag: Tag) => {
    if (!simulateNfcEnabled) {
      setError("NFC-simulering är avstängd i admin.");
      return;
    }
    setBusy(true);
    setError("");
    const player = getPlayer();
    const r = await fetch("/api/quest-progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerName: player?.name,
        questId: quest.id,
        tagId: tag.id,
        stationKey: tag.stationKey,
      }),
    });
    const data = await r.json();
    setBusy(false);
    if (!r.ok) {
      setError(data.error || "Kunde inte registrera skanning.");
      return;
    }
    const ids = (data.scans || []).map((s: { tagId: string }) => s.tagId);
    setScanned(ids);
    if (ids.length >= required.length) {
      if (steps.length) setPhase("puzzle");
      else await finish([]);
    }
  };

  const submitStep = async () => {
    if (!current) return;
    if (current.tagId && !scanned.includes(current.tagId)) {
      setError("Skanna rätt NFC-tagg innan du svarar på detta steg.");
      return;
    }
    const value = answer.trim();
    if (!value) {
      setError("Ange ett svar.");
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
        <p className="eyebrow">LIVE QUEST · NFC + PUZZEL</p>
        <h2>{quest.title}</h2>

        {phase === "nfc" && (
          <div className="game-body">
            <span className="game-kicker">
              SKANNA {scanned.length}/{required.length} TAGGA
            </span>
            <p>Skanning krävs innan du får gå vidare. Håll mobilen mot brickan – eller simulera om det är aktiverat.</p>
            <div className="tag-scan-list">
              {required.map((tag) => {
                const ok = scanned.includes(tag.id);
                return (
                  <div key={tag.id} className={`tag-scan-row ${ok ? "done" : ""}`}>
                    <div>
                      <b>{tag.name}</b>
                      <small>
                        {tag.id} · {tag.location || tag.stationKey}
                      </small>
                    </div>
                    {ok ? (
                      <em>✓ SKANNAD</em>
                    ) : (
                      <button
                        className="ghost"
                        disabled={busy || !simulateNfcEnabled}
                        onClick={() => simulateTag(tag)}
                      >
                        {simulateNfcEnabled ? "⌁ SIMULERA NFC" : "NFC KRÄVS"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {!remaining.length && (
              <button className="primary full" onClick={() => (steps.length ? setPhase("puzzle") : finish([]))}>
                FORTSÄTT
              </button>
            )}
          </div>
        )}

        {phase === "puzzle" && current && (
          <div className="game-body">
            <span className="game-kicker">
              STEG {stepIndex + 1} AV {steps.length}
            </span>
            <h3>{current.prompt}</h3>
            {current.type === "choice" ? (
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

        {phase === "done" && (
          <div className="game-result">
            <div className="result-mark success">✓</div>
            <h3>Quest slutförd!</h3>
            <p>Din insats är registrerad och poängen har lagts till.</p>
            <button className="primary full" onClick={onClose}>
              TILLBAKA TILL QUESTS
            </button>
          </div>
        )}

        {error && <p className="error-note">{error}</p>}
      </section>
    </div>
  );
}
