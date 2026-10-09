import { requireAdminApi } from "@/lib/admin-session";
import { getGameSettings, updateGameSettings } from "@/lib/db";
import type { CommunityUnlockRule, UnlockMetric } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAdminApi(request);
  if (denied) return denied;
  return Response.json({ settings: await getGameSettings() });
}

export async function PATCH(request: Request) {
  const denied = await requireAdminApi(request);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const changes: {
    simulateNfcEnabled?: boolean;
    unlocks?: CommunityUnlockRule[];
  } = {};

  if ("simulateNfcEnabled" in (body as object)) {
    changes.simulateNfcEnabled = Boolean(
      (body as { simulateNfcEnabled?: boolean }).simulateNfcEnabled,
    );
  }

  if (Array.isArray((body as { unlocks?: unknown }).unlocks)) {
    changes.unlocks = (body as { unlocks: CommunityUnlockRule[] }).unlocks.map((u) => ({
      questId: Number(u.questId),
      title: String(u.title || "").slice(0, 80),
      metric: (["scans", "xp", "none"].includes(u.metric)
        ? u.metric
        : "scans") as UnlockMetric,
      at: Math.max(0, Number(u.at) || 0),
    }));
  }

  const settings = await updateGameSettings(changes);
  return Response.json({ settings });
}
