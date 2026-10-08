import { cookies } from "next/headers";

const COOKIE = "gg_admin";
const encoder = new TextEncoder();

function adminPin() {
  return String(process.env.ADMIN_PIN || "").trim();
}

async function sessionToken(pin: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`gg-admin:${pin}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode("parkaden-admin"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function adminConfigured() {
  return adminPin().length >= 4;
}

function cookieFlags(maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly${secure}`;
}

export async function createAdminCookieHeader() {
  const pin = adminPin();
  if (!pin) throw new Error("ADMIN_PIN saknas");
  const token = await sessionToken(pin);
  return `${COOKIE}=${token}; ${cookieFlags(2592000)}`;
}

export function clearAdminCookieHeader() {
  return `${COOKIE}=; ${cookieFlags(0)}`;
}

export async function verifyAdminPin(pin: string) {
  const expected = adminPin();
  if (!expected || pin !== expected) return false;
  return true;
}

export async function isAdminRequest(request?: Request) {
  const pin = adminPin();
  if (!pin) return false;
  const expected = await sessionToken(pin);

  let raw = "";
  if (request) {
    raw = decodeURIComponent(
      (request.headers.get("cookie") || "").match(/(?:^|; )gg_admin=([^;]+)/)?.[1] || "",
    );
  } else {
    const jar = await cookies();
    raw = jar.get(COOKIE)?.value || "";
  }

  return raw.length > 0 && raw === expected;
}

export async function requireAdminApi(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Inte inloggad" }, { status: 401 });
  }
  return null;
}
