import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
  const jar = await cookies();
  jar.set("__session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return Response.json(
    { ok: true },
    { headers: { "cache-control": "private, no-store" } },
  );
}
