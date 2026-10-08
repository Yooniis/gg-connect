import {
  adminConfigured,
  createAdminCookieHeader,
  verifyAdminPin,
} from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!adminConfigured()) {
    return Response.json(
      { error: "ADMIN_PIN saknas i miljövariabler." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const pin = String((body as { pin?: string }).pin || "");
  if (!(await verifyAdminPin(pin))) {
    return Response.json({ error: "Fel admin-PIN." }, { status: 401 });
  }

  return Response.json(
    { ok: true },
    { headers: { "set-cookie": await createAdminCookieHeader() } },
  );
}
