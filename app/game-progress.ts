import { getPlayer } from "./player-session";

export async function awardQuest(
  quest: { id: number; title: string; xp: number },
  opts?: {
    answers?: { stepId: string; answer: string }[];
    skipPuzzleCheck?: boolean;
  },
) {
  const player = getPlayer();
  if (!player) {
    window.dispatchEvent(new Event("open-player-profile"));
    return { awarded: false, error: "Profil saknas" };
  }
  const r = await fetch("/api/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerName: player.name,
      questId: quest.id,
      questTitle: quest.title,
      xp: quest.xp,
      answers: opts?.answers || [],
      skipPuzzleCheck: Boolean(opts?.skipPuzzleCheck),
    }),
  });
  const data = await r.json();
  if (!r.ok) return { awarded: false, error: data.error || "Kunde inte spara" };
  if (data.award) window.dispatchEvent(new CustomEvent("xp-awarded", { detail: data.award }));
  window.dispatchEvent(new Event("progress-updated"));
  window.dispatchEvent(new Event("community-scan"));
  return data;
}

export async function acceptQuest(quest: { id: number; title: string }) {
  const player = getPlayer();
  if (!player) {
    window.dispatchEvent(new Event("open-player-profile"));
    return { accepted: false, error: "Profil saknas" };
  }
  const r = await fetch("/api/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "accept",
      playerName: player.name,
      questId: quest.id,
      questTitle: quest.title,
    }),
  });
  const data = await r.json();
  if (!r.ok) return { accepted: false, error: data.error || "Kunde inte anta" };
  window.dispatchEvent(new Event("progress-updated"));
  return data;
}
