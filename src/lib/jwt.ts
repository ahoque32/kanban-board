export type JwtPayload = {
  sub: number;
  email: string;
  name: string;
  role: "admin" | "user";
  exp: number;
};

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function base64urlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecode(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bytes = fromBase64(base64);
  return new TextDecoder().decode(bytes);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64urlEncode(new Uint8Array(signature));
}

export async function signJwt(payload: Omit<JwtPayload, "exp">, expiresInSeconds: number, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = await hmacSha256(data, secret);

  return `${data}.${signature}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) return null;

  const expected = await hmacSha256(`${encodedHeader}.${encodedPayload}`, secret);
  if (!constantTimeEqual(expected, signature)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload)) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return null;
    if (!payload.sub || !payload.email || !payload.name || !payload.role) return null;
    if (payload.role !== "admin" && payload.role !== "user") return null;
    return payload;
  } catch {
    return null;
  }
}
