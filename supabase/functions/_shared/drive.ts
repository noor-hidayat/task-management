// Google Drive client untuk Edge Function.
// Auth: dua mode (dipilih otomatis):
//   1) OAuth user (refresh token) — untuk Gmail gratisan. Dipakai kalau
//      GOOGLE_REFRESH_TOKEN diset. Kuota pakai Drive user tersebut.
//   2) Service Account (JWT) — untuk Workspace + Shared Drive.
// Scope drive.file: hanya mengakses file/folder yang dibuat app ini.
//
// Secrets yang dibutuhkan (supabase secrets set):
//   GOOGLE_DRIVE_FOLDER_ID               (root folder)
//   Mode OAuth (gmail gratis): GOOGLE_OAUTH_CLIENT_ID,
//     GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//   Mode SA (workspace): GOOGLE_SERVICE_ACCOUNT_EMAIL,
//     GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (PEM, boleh pakai \n literal)

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const SCOPE = "https://www.googleapis.com/auth/drive.file";

interface TokenCache {
  token: string;
  expiresAt: number;
}
let cachedToken: TokenCache | null = null;

/* ── base64url ─────────────────────────────────────────────── */
function base64UrlEncode(input: Uint8Array | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): Uint8Array {
  const cleaned = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(cleaned);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/* ── Access token (otomatis pilih mode) ─────────────────────── */
export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.token;

  // Mode 1: OAuth user (gmail gratisan) — prioritas kalau diset.
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (refreshToken) {
    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error(
        "GOOGLE_REFRESH_TOKEN diset tapi GOOGLE_OAUTH_CLIENT_ID/SECRET belum diset."
      );
    }
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) {
      throw new Error(`Gagal refresh access token Google: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      token: data.access_token,
      expiresAt: now + (data.expires_in ?? 3600),
    };
    return cachedToken.token;
  }

  // Mode 2: Service Account (workspace + Shared Drive).
  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKeyPem = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  if (!email || !privateKeyPem) {
    throw new Error(
      "Kredensial Google Service Account belum diset (GOOGLE_SERVICE_ACCOUNT_EMAIL / _PRIVATE_KEY)."
    );
  }

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope: SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload)
  )}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Gagal ambil access token Google: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600),
  };
  return cachedToken.token;
}

async function authHeaders(): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await getAccessToken()}` };
}

/* ── Folder ─────────────────────────────────────────────────── */
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Cari subfolder ber-nama `name` di bawah `parentId`; buat bila tidak ada. */
export async function ensureFolder(name: string, parentId: string): Promise<string> {
  const headers = await authHeaders();
  const q = [
    `mimeType = '${FOLDER_MIME}'`,
    `name = '${name.replace(/'/g, "\\'")}'`,
    `'${parentId}' in parents`,
    "trashed = false",
  ].join(" and ");

  const searchRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers }
  );
  if (searchRes.ok) {
    const found = (await searchRes.json()) as { files: { id: string }[] };
    if (found.files?.length) return found.files[0].id;
  }

  const createRes = await fetch(`${DRIVE_API}/files?fields=id&supportsAllDrives=true`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!createRes.ok) {
    throw new Error(`Gagal buat folder Drive: ${createRes.status} ${await createRes.text()}`);
  }
  return ((await createRes.json()) as { id: string }).id;
}

/* ── Upload (multipart) ─────────────────────────────────────── */
export interface UploadResult {
  id: string;
  name: string;
  webViewLink?: string;
  size?: number;
}

export async function uploadFile(opts: {
  folderId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<UploadResult> {
  const headers = await authHeaders();
  const boundary = `tm-${crypto.randomUUID()}`;
  const meta = {
    name: opts.fileName,
    parents: [opts.folderId],
  };

  const enc = new TextEncoder();
  const pre = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: ${opts.mimeType || "application/octet-stream"}\r\n\r\n`
  );
  const post = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(pre.length + opts.bytes.length + post.length);
  body.set(pre, 0);
  body.set(opts.bytes, pre.length);
  body.set(post, pre.length + opts.bytes.length);

  const res = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink,size&supportsAllDrives=true`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  if (!res.ok) {
    throw new Error(`Gagal upload ke Drive: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string; name: string; webViewLink?: string; size?: string };
  return { id: data.id, name: data.name, webViewLink: data.webViewLink, size: Number(data.size) };
}

/* ── Download / metadata ────────────────────────────────────── */
export async function getFileMeta(fileId: string): Promise<{
  id: string;
  name: string;
  mimeType: string;
  size?: number;
}> {
  const headers = await authHeaders();
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?fields=id,name,mimeType,size&supportsAllDrives=true`,
    { headers }
  );
  if (!res.ok) throw new Error(`File tidak ditemukan: ${res.status}`);
  return await res.json();
}

export async function downloadFile(fileId: string): Promise<Response> {
  const headers = await authHeaders();
  return await fetch(`${DRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers,
  });
}

/* ── Delete ─────────────────────────────────────────────────── */
export async function deleteFile(fileId: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_API}/files/${fileId}?supportsAllDrives=true`, {
    method: "DELETE",
    headers,
  });
  // 404 dianggap sudah terhapus.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Gagal hapus file Drive: ${res.status} ${await res.text()}`);
  }
}

/** Root folder dari env. */
export function rootFolderId(): string {
  const id = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");
  if (!id) throw new Error("GOOGLE_DRIVE_FOLDER_ID belum diset.");
  return id;
}
