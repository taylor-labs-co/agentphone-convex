const encoder = new TextEncoder();

export type VerifyAgentPhoneSignatureArgs = {
  rawBody: string;
  signature: string | null | undefined;
  timestamp: string | null | undefined;
  secret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
};

export function isTimestampWithinTolerance(
  timestamp: string | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
) {
  if (!timestamp) {
    return false;
  }
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  return Math.abs(nowSeconds - parsed) <= toleranceSeconds;
}

export async function verifyAgentPhoneSignature({
  rawBody,
  signature,
  timestamp,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
}: VerifyAgentPhoneSignatureArgs) {
  if (!signature || !timestamp || !secret) {
    return false;
  }
  if (!isTimestampWithinTolerance(timestamp, nowSeconds, toleranceSeconds)) {
    return false;
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  const supplied = normalizeSignature(signature);
  if (!supplied) {
    return false;
  }
  return constantTimeEqual(expected, supplied);
}

export async function hmacSha256Hex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

export function normalizeSignature(signature: string) {
  const value = signature.startsWith("sha256=")
    ? signature.slice("sha256=".length)
    : signature;
  if (!/^[a-fA-F0-9]+$/.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}
