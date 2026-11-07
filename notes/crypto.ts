// Optional note locks. The text is encrypted with AES-GCM using a key derived from the
// password with PBKDF2, so a locked note is unreadable without it (there is no recovery).

export type Cipher = { v: 1; salt: string; iv: string; data: string };

const ITERATIONS = 150_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

function randomBuffer(length: number): ArrayBuffer {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(bytes);
  return bytes.buffer;
}

async function keyFrom(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(password: string, text: string): Promise<Cipher> {
  const salt = randomBuffer(16);
  const iv = randomBuffer(12);
  const key = await keyFrom(password, salt);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { v: 1, salt: bytesToBase64(new Uint8Array(salt)), iv: bytesToBase64(new Uint8Array(iv)), data: bytesToBase64(new Uint8Array(data)) };
}

/** Throws when the password is wrong or the data was damaged. */
export async function decryptText(password: string, cipher: Cipher): Promise<string> {
  const key = await keyFrom(password, base64ToBuffer(cipher.salt));
  const data = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuffer(cipher.iv) },
    key,
    base64ToBuffer(cipher.data),
  );
  return new TextDecoder().decode(data);
}
