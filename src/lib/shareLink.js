// Packs a whole debate into the URL itself (gzip via the browser's native
// CompressionStream, base64url-encoded) so a link reproduces the exact
// same debate for anyone who opens it — no server-side storage needed,
// consistent with the API being otherwise fully stateless.
const MAX_URL_LENGTH = 8000;

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function gzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodeDebateToUrl(debate) {
  const json = JSON.stringify(debate);
  const compressed = await gzip(new TextEncoder().encode(json));
  const encoded = bytesToBase64Url(compressed);
  const url = `${location.origin}${location.pathname}#share=${encoded}`;
  if (url.length > MAX_URL_LENGTH) {
    throw new Error("This debate is too large to share as a link — try exporting it instead.");
  }
  return url;
}

export async function decodeDebateFromHash(hash) {
  const match = /^#share=(.+)$/.exec(hash);
  if (!match) return null;
  try {
    const compressed = base64UrlToBytes(match[1]);
    const json = new TextDecoder().decode(await gunzip(compressed));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
