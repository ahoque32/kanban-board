type JwtPayload = {
  sub?: string;
  email?: string;
  name?: string;
  role?: "admin" | "user";
  exp?: number;
};

function base64UrlToUint8Array(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlToString(input: string) {
  const bytes = base64UrlToUint8Array(input);
  return new TextDecoder().decode(bytes);
}

export async function verifyJwtHs256(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const headerText = base64UrlToString(encodedHeader);

  let header: { alg?: string; typ?: string };
  let payload: JwtPayload;

  try {
    header = JSON.parse(headerText);
    payload = JSON.parse(base64UrlToString(encodedPayload));
  } catch {
    return null;
  }

  if (header.alg !== "HS256") return null;

  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signature = base64UrlToUint8Array(encodedSignature);
  const valid = await crypto.subtle.verify("HMAC", key, signature, data);
  if (!valid) return null;

  if (typeof payload.exp === "number") {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSeconds) return null;
  }

  return payload;
}
