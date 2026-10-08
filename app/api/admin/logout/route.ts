import { clearAdminCookieHeader } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json(
    { ok: true },
    { headers: { "set-cookie": clearAdminCookieHeader() } },
  );
}
