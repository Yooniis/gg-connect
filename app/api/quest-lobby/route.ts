import {
  acceptJoinRequest,
  clearQuestPresence,
  createQuestLobby,
  declineJoinRequest,
  findPlayerLobby,
  formPartyFromSelection,
  getLobby,
  inviteToLobby,
  joinQuestLobby,
  leaveLobby,
  listOpenLobbies,
  listQuestPresence,
  recordLobbyScan,
  sessionFromRequest,
  startLobbyWindow,
  setLobbyReady,
  touchQuestPresence,
} from "@/lib/db";
import { nameKey, partySizeForQuest } from "@/lib/types";

export const dynamic = "force-dynamic";

async function identity(request: Request, body: Record<string, unknown> = {}) {
  const fallback = String(body.playerName || "").slice(0, 30);
  const tokenOverride = String(body.playerToken || body.token || "").trim();
  return sessionFromRequest(request, fallback, tokenOverride);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const questId = Number(url.searchParams.get("questId") || 0);
  const lobbyId = url.searchParams.get("lobbyId") || "";
  const playerName = url.searchParams.get("playerName") || "";
  const playerToken = url.searchParams.get("playerToken") || "";
  const me = await sessionFromRequest(request, playerName, playerToken);

  if (lobbyId) {
    const lobby = await getLobby(lobbyId);
    if (!lobby) return Response.json({ error: "Lobyn finns inte" }, { status: 404 });
    return Response.json({ lobby }, { headers: { "cache-control": "no-store" } });
  }

  if (!questId) {
    return Response.json({ error: "questId krävs" }, { status: 400 });
  }

  if (me.token) {
    await touchQuestPresence({
      questId,
      name: me.name || playerName,
      token: me.token,
    });
  }

  const [lobbies, waiting, mine] = await Promise.all([
    listOpenLobbies(questId),
    listQuestPresence(questId),
    me.token
      ? findPlayerLobby(questId, me.token, me.name || playerName)
      : Promise.resolve(null),
  ]);

  const myName = nameKey(me.name || playerName);
  const others = waiting.filter((w) => {
    if (!w.name || !w.token) return false;
    if (me.token && w.token === me.token) return false;
    if (myName && nameKey(w.name) === myName) return false;
    return true;
  });

  // Only show joinable lobbies that aren't yours and aren't full
  const joinable = lobbies.filter((l) => {
    if (l.members.length >= l.requiredPlayers) return false;
    if (me.token && l.hostToken === me.token) return false;
    if (myName && nameKey(l.hostName) === myName) return false;
    if (me.token && l.members.some((m) => m.token === me.token)) return false;
    if (myName && l.members.some((m) => nameKey(m.name) === myName)) return false;
    return true;
  });

  return Response.json(
    {
      requiredPlayers: partySizeForQuest(questId),
      lobbies: joinable,
      waiting: others,
      lobby: mine?.lobby || null,
      membership: mine?.membership || "none",
      player: { name: me.name, token: me.token },
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const me = await identity(request, body);
  if (!me.name || !me.token) {
    return Response.json(
      { error: "Skapa en spelarprofil först (saknar spelarsession)." },
      { status: 401 },
    );
  }

  const action = String(body.action || "");
  const questId = Number(body.questId || 0);
  const lobbyId = String(body.lobbyId || "");

  try {
    if (action === "create") {
      if (!questId) return Response.json({ error: "questId krävs" }, { status: 400 });
      const lobby = await createQuestLobby({
        questId,
        questTitle: String(body.questTitle || `Uppdrag ${questId}`),
        questType: String(body.questType || ""),
        name: me.name,
        token: me.token,
      });
      return Response.json({ lobby, membership: "member" });
    }

    if (action === "form") {
      if (!questId) return Response.json({ error: "questId krävs" }, { status: 400 });
      const selected = Array.isArray(body.selected)
        ? (body.selected as { name?: string; token?: string }[])
            .map((i) => ({ name: String(i.name || ""), token: String(i.token || "") }))
            .filter((i) => i.name && i.token && nameKey(i.name) !== nameKey(me.name))
        : [];
      const result = await formPartyFromSelection({
        questId,
        questTitle: String(body.questTitle || `Uppdrag ${questId}`),
        questType: String(body.questType || ""),
        hostName: me.name,
        hostToken: me.token,
        selected,
      });
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({ lobby: result.lobby, membership: "member" });
    }

    if (action === "join") {
      if (!lobbyId) return Response.json({ error: "lobbyId krävs" }, { status: 400 });
      const result = await joinQuestLobby(lobbyId, me.name, me.token);
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      await touchQuestPresence({ questId: result.lobby.questId, name: me.name, token: me.token });
      return Response.json({ lobby: result.lobby, membership: result.membership });
    }

    if (action === "accept") {
      if (!lobbyId) return Response.json({ error: "lobbyId krävs" }, { status: 400 });
      const applicantToken = String(body.applicantToken || "");
      if (!applicantToken) {
        return Response.json({ error: "applicantToken krävs" }, { status: 400 });
      }
      const result = await acceptJoinRequest(lobbyId, me.token, applicantToken);
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({ lobby: result.lobby, membership: "member" });
    }

    if (action === "decline") {
      if (!lobbyId) return Response.json({ error: "lobbyId krävs" }, { status: 400 });
      const applicantToken = String(body.applicantToken || me.token);
      const result = await declineJoinRequest(lobbyId, me.token, applicantToken);
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({
        lobby: result.lobby,
        membership: applicantToken === me.token ? "none" : "member",
      });
    }

    if (action === "invite") {
      if (!lobbyId) return Response.json({ error: "lobbyId krävs" }, { status: 400 });
      const invitees = Array.isArray(body.invitees)
        ? (body.invitees as { name?: string; token?: string }[])
            .map((i) => ({ name: String(i.name || ""), token: String(i.token || "") }))
            .filter((i) => i.name && i.token && nameKey(i.name) !== nameKey(me.name))
        : [];
      const result = await inviteToLobby(lobbyId, me.token, invitees);
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({ lobby: result.lobby, membership: "member" });
    }

    if (action === "ready") {
      if (!lobbyId) return Response.json({ error: "lobbyId krävs" }, { status: 400 });
      const ready = body.ready !== false;
      const result = await setLobbyReady(lobbyId, me.token, ready, me.name);
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({ lobby: result.lobby, membership: "member" });
    }

    if (action === "window") {
      if (!lobbyId) return Response.json({ error: "lobbyId krävs" }, { status: 400 });
      const result = await startLobbyWindow(lobbyId, me.token, 10);
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({ lobby: result.lobby, membership: "member" });
    }

    if (action === "scan") {
      if (!lobbyId) return Response.json({ error: "lobbyId krävs" }, { status: 400 });
      const slot = Number(body.slot);
      if (!Number.isInteger(slot) || slot < 0) {
        return Response.json({ error: "Ogiltig nod" }, { status: 400 });
      }
      const result = await recordLobbyScan(lobbyId, me.token, slot);
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({ lobby: result.lobby, complete: result.complete });
    }

    if (action === "leave") {
      if (lobbyId) {
        const result = await leaveLobby(lobbyId, me.token);
        if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      }
      if (questId) await clearQuestPresence(questId, me.name);
      return Response.json({ lobby: null, membership: "none" });
    }

    return Response.json({ error: "Okänd action" }, { status: 400 });
  } catch (err) {
    console.error("quest-lobby", err);
    return Response.json({ error: "Lobbyfel" }, { status: 500 });
  }
}
