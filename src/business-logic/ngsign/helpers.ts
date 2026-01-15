import urlJoin from "url-join";

export const ngSignUrls = {
  sandbox: "https://sandbox.ngsign.com",
  production: "https://api.ngsign.com",
};

export const ngSignBase = (path: string, mode: "PROD" | "TEST" = "TEST") => {
  const base = mode === "PROD" ? ngSignUrls.production : ngSignUrls.sandbox;
  return urlJoin(base, path);
};

export function toBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export async function ngsignFetch<T>(
  path: string,
  token: string,
  options: RequestInit,
  mode?: "PROD" | "TEST"
): Promise<T> {
  if (!token) {
    throw new Error("NGSign token is not defined");
  }

  const res = await fetch(ngSignBase(path, mode), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NGSign error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}
