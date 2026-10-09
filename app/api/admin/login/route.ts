import { cookies } from "next/headers";
import {
  adminConfigured,
  createAdminCookieValue,
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

  const token = await createAdminCookieValue();
  const jar = await cookies();
  jar.set("__session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return Response.json(
    { ok: true },
    { headers: { "cache-control": "private, no-store" } },
  );
}
