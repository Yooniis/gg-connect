"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getPlayer } from "./player-session";
import type { QuestLobby as Lobby } from "@/lib/types";
import { nameKey } from "@/lib/types";

type Waiting = { name: string; token: string };
type Membership = "none" | "member" | "pending";

type Props = {
  questId: number;
  questTitle: string;
  questType?: string;
  requiredPlayers: number;
  onClose: () => void;
  onStarted: (lobby: Lobby, mySlot: number) => void;
};

export default function QuestLobby({
  questId,
  questTitle,
  questType,
  requiredPlayers,
  onClose,
  onStarted,
}: Props) {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [membership, setMembership] = useState<Membership>("none");
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [openLobbies, setOpenLobbies] = useState<Lobby[]>([]);
  const [selected, setSelected] = useState<Waiting[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(false);
  const player = getPlayer();

  const seatsNeeded = Math.max(1, requiredPlayers - 1);

  const isMe = (p: { name?: string; token?: string }) => {
    if (!player) return false;
    if (p.token && player.token && p.token === player.token) return true;
    if (p.name && nameKey(p.name) === nameKey(player.name)) return true;
    return false;
  };

  const othersWaiting = useMemo(
    () => waiting.filter((w) => !isMe(w)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [waiting, player?.token, player?.name],
  );

  const authPayload = () =>
    player
      ? { playerName: player.name, playerToken: player.token }
      : {};

  const applyLobby = (next: Lobby | null, nextMembership: Membership) => {
    setLobby(next);
    setMembership(nextMembership);
    if (
      next &&
      nextMembership === "member" &&
      next.status === "running" &&
      player &&
      !startedRef.current
    ) {
      startedRef.current = true;
      const slot =
        next.assignments?.[player.token] ??
        next.members.findIndex((m) => isMe(m));
      onStarted(next, Math.max(0, slot));
    }
  };

  const refresh = async () => {
    if (!player) return;
    try {
      const q = new URLSearchParams({
        questId: String(questId),
        playerName: player.name,
        playerToken: player.token,
      });
      const r = await fetch(`/api/quest-lobby?${q}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setWaiting(d.waiting || []);
      setOpenLobbies(d.lobbies || []);
      const nextMembership = (d.membership as Membership) || "none";
      applyLobby(d.lobby || null, nextMembership);
    } catch {
      /* ignore poll blips */
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questId]);

  const post = async (body: Record<string, unknown>) => {
    if (!player) return null;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/quest-lobby", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...authPayload(),
          questId,
          questTitle,
          questType,
          ...body,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Något gick fel");
      applyLobby(d.lobby || null, (d.membership as Membership) || "none");
      await refresh();
      return d;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const toggleSelect = (person: Waiting) => {
    if (isMe(person)) return;
    setSelected((prev) => {
      if (prev.some((p) => p.token === person.token || nameKey(p.name) === nameKey(person.name))) {
        return prev.filter(
          (p) => p.token !== person.token && nameKey(p.name) !== nameKey(person.name),
        );
      }
      if (prev.length >= seatsNeeded) return [person];
      return [...prev, person];
    });
  };

  const formParty = async () => {
    if (!player) return;
    const picks = selected.filter((p) => !isMe(p));
    if (picks.length !== seatsNeeded) {
      setError(`Välj ${seatsNeeded} lagkamrat${seatsNeeded === 1 ? "" : "er"} innan du bildar lag.`);
      return;
    }
    const result = await post({ action: "form", selected: picks });
    if (result?.lobby) setSelected([]);
  };

  const me = lobby?.members.find((m) => isMe(m));
  const isHost =
    !!lobby &&
    (lobby.hostToken === player?.token || nameKey(lobby.hostName) === nameKey(player?.name || ""));
  const full = (lobby?.members.length || 0) >= requiredPlayers;
  const allReady = full && (lobby?.members.every((m) => m.ready) ?? false);
  const pendingRequests = lobby?.pending || [];

  const leave = async () => {
    await post({ action: "leave", lobbyId: lobby?.id || "" });
    applyLobby(null, "none");
    onClose();
  };

  if (!player) {
    return (
      <div className="modal-backdrop">
        <section className="quest-lobby-modal">
          <button className="close" onClick={onClose}>
            ×
          </button>
          <p className="eyebrow">LAGLOBBY</p>
          <h2>Skapa profil först</h2>
          <p>Du behöver en spelarprofil innan du kan gå med i ett laguppdrag.</p>
        </section>
      </div>
    );
  }

  if (membership === "pending" && lobby) {
    return (
      <div className="modal-backdrop">
        <section className="quest-lobby-modal">
          <button className="close" onClick={leave}>
            ×
          </button>
          <p className="eyebrow">LAGLOBBY · {requiredPlayers} SPELARE</p>
          <h2>{questTitle}</h2>
          <div className="lobby-section">
            <h3>Förfrågan skickad</h3>
            <p className="lobby-wait-note">
              Du har bett om att gå med i <b>{lobby.hostName}</b>s lag. Du syns inte i laget förrän
              värden trycker <b>Acceptera lagkamrat</b>.
            </p>
            <button
              className="ghost full"
              disabled={busy}
              onClick={() =>
                post({
                  action: "decline",
                  lobbyId: lobby.id,
                  applicantToken: player.token,
                })
              }
            >
              AVBRYT FÖRFRÅGAN
            </button>
          </div>
          {error && <p className="error-note">{error}</p>}
        </section>
      </div>
    );
  }

  // In a team — only show the team screen (never the create/join picker)
  if (membership === "member" && lobby && lobby.status !== "running") {
    return (
      <div className="modal-backdrop">
        <section className="quest-lobby-modal">
          <button className="close" onClick={leave}>
            ×
          </button>
          <p className="eyebrow">LAGLOBBY · {requiredPlayers} SPELARE</p>
          <h2>{questTitle}</h2>
          <p className="lobby-lead">När laget är fullt måste alla trycka redo för att starta.</p>

          <div className="lobby-section">
            <h3>
              Ert lag · {lobby.members.length}/{lobby.requiredPlayers}
            </h3>
            <ul className="lobby-members">
              {lobby.members.map((m) => {
                const tags = [
                  m.token === lobby.hostToken || nameKey(m.name) === nameKey(lobby.hostName)
                    ? "värd"
                    : "",
                  isMe(m) ? "du" : "",
                ].filter(Boolean);
                return (
                  <li key={m.token || m.name} className={m.ready ? "ready" : ""}>
                    <span>
                      {m.name}
                      {tags.length ? ` · ${tags.join(" · ")}` : ""}
                    </span>
                    <em>{m.ready ? "REDO" : "VÄNTAR"}</em>
                  </li>
                );
              })}
              {Array.from({ length: Math.max(0, requiredPlayers - lobby.members.length) }).map(
                (_, i) => (
                  <li key={`empty-${i}`} className="empty">
                    <span>Ledig plats</span>
                    <em>—</em>
                  </li>
                ),
              )}
            </ul>

            {isHost && pendingRequests.length > 0 && (
              <div className="lobby-invite">
                <h4>Acceptera lagkamrat</h4>
                <ul className="lobby-pick-list">
                  {pendingRequests.map((p) => (
                    <li key={p.token}>
                      <button
                        type="button"
                        className="picked"
                        disabled={busy || full}
                        onClick={() =>
                          post({
                            action: "accept",
                            lobbyId: lobby.id,
                            applicantToken: p.token,
                          })
                        }
                      >
                        <span>{p.name}</span>
                        <em>ACCEPTERA</em>
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        disabled={busy}
                        onClick={() =>
                          post({
                            action: "decline",
                            lobbyId: lobby.id,
                            applicantToken: p.token,
                          })
                        }
                      >
                        AVBÖJ
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isHost && !full && othersWaiting.length > 0 && (
              <div className="lobby-invite">
                <h4>Bjud in väntande</h4>
                <ul className="lobby-pick-list">
                  {othersWaiting
                    .filter(
                      (w) =>
                        !lobby.members.some(
                          (m) => m.token === w.token || nameKey(m.name) === nameKey(w.name),
                        ) && !pendingRequests.some((p) => p.token === w.token),
                    )
                    .map((w) => (
                      <li key={w.token}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            post({
                              action: "invite",
                              lobbyId: lobby.id,
                              invitees: [w],
                            })
                          }
                        >
                          <span>{w.name}</span>
                          <em>BJUD IN</em>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {!full && (
              <p className="lobby-wait-note">
                Väntar på {requiredPlayers - lobby.members.length} spelare till.
              </p>
            )}
            {full && !allReady && (
              <p className="lobby-wait-note">Alla i laget måste trycka redo innan uppdraget börjar.</p>
            )}

            <button
              className="primary full"
              disabled={busy || !full}
              onClick={() => post({ action: "ready", lobbyId: lobby.id, ready: !me?.ready })}
            >
              {!full ? "VÄNTAR PÅ FULLT LAG…" : me?.ready ? "INTE REDO ÄN" : "JAG ÄR REDO"}
            </button>
            <button
              className="ghost full"
              style={{ marginTop: 10 }}
              disabled={busy}
              onClick={() => post({ action: "leave", lobbyId: lobby.id })}
            >
              LÄMNA LAG
            </button>
          </div>
          {error && <p className="error-note">{error}</p>}
        </section>
      </div>
    );
  }

  // Not in a team yet — pick teammates or request to join
  return (
    <div className="modal-backdrop">
      <section className="quest-lobby-modal">
        <button className="close" onClick={leave}>
          ×
        </button>
        <p className="eyebrow">LAGLOBBY · {requiredPlayers} SPELARE</p>
        <h2>{questTitle}</h2>
        <p className="lobby-lead">
          Välj lagkamrat och bilda lag — eller be om att gå med i någon annans lag. Värden måste
          acceptera förfrågningar.
        </p>

        <div className="lobby-section">
          <h3>Välj lagkamrater ({selected.length}/{seatsNeeded})</h3>
          {othersWaiting.length === 0 ? (
            <p className="lobby-empty">Inga andra väntar ännu. Be dem öppna samma uppdrag.</p>
          ) : (
            <ul className="lobby-pick-list">
              {othersWaiting.map((w) => {
                const picked = selected.some(
                  (p) => p.token === w.token || nameKey(p.name) === nameKey(w.name),
                );
                return (
                  <li key={w.token}>
                    <button
                      type="button"
                      className={picked ? "picked" : ""}
                      onClick={() => toggleSelect(w)}
                    >
                      <span>{w.name}</span>
                      <em>{picked ? "VALD" : "VÄLJ"}</em>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            className="primary full"
            disabled={busy || selected.length !== seatsNeeded}
            onClick={() => void formParty()}
          >
            {busy ? "BILDAR LAG…" : `BILDA LAG (${requiredPlayers} ST)`}
          </button>
        </div>

        {openLobbies.length > 0 && (
          <div className="lobby-section">
            <h3>Eller be om att gå med</h3>
            <ul className="lobby-open-list">
              {openLobbies.map((l) => (
                <li key={l.id}>
                  <div>
                    <b>{l.hostName}</b>
                    <small>
                      {l.members.map((m) => m.name).join(", ")} · {l.members.length}/
                      {l.requiredPlayers}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="ghost"
                    disabled={busy}
                    onClick={() => post({ action: "join", lobbyId: l.id })}
                  >
                    GÅ MED
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          className="ghost full"
          disabled={busy}
          onClick={() => post({ action: "create" })}
          style={{ marginTop: 12 }}
        >
          SKAPA TOMT LAG OCH VÄNTA
        </button>

        {error && <p className="error-note">{error}</p>}
      </section>
    </div>
  );
}
