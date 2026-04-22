// Tiny signed-cookie session for the shared password gate.
// Uses Web Crypto so it runs in both the Proxy runtime and Route Handlers.

const COOKIE_NAME = "picta_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export { COOKIE_NAME };
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer): string {
  const b = Buffer.from(new Uint8Array(bytes)).toString("base64");
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64url(sig);
}

export async function makeToken(password: string, secret: string): Promise<string> {
  const issued = Math.floor(Date.now() / 1000);
  const pwHash = await hmac(password, secret);
  const payload = `${issued}.${pwHash}`;
  const sig = await hmac(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyToken(
  token: string | undefined,
  password: string,
  secret: string,
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [issued, pwHash, sig] = parts;
  const expectedSig = await hmac(`${issued}.${pwHash}`, secret);
  if (!constantTimeEqual(sig, expectedSig)) return false;
  const expectedPwHash = await hmac(password, secret);
  if (!constantTimeEqual(pwHash, expectedPwHash)) return false;
  const issuedNum = Number(issued);
  if (!Number.isFinite(issuedNum)) return false;
  const age = Math.floor(Date.now() / 1000) - issuedNum;
  return age >= 0 && age < MAX_AGE_SECONDS;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
