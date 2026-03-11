import urlJoin from "url-join";
import { TkrAppError } from "../../utils/error.utils.js";

export const ngSignUrls = {
  sandbox: "https://sandbox.ng-sign.com/server",
  production: "https://api.ng-sign.com/server",
};

export const ngSignBase = (path: string, mode: "PROD" | "TEST" = "TEST") => {
  let base = mode === "PROD" ? ngSignUrls.production : ngSignUrls.sandbox;
  // Remove /server from the path if it exists
  if (mode === "TEST") {
    base = base.replace(/\/?server\/?/, "");
  }
  return urlJoin(base, path);
};

export function toBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export async function ngsignFetch<T>(
  path: string,
  token: string,
  options: RequestInit,
  mode?: "PROD" | "TEST",
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

    // Handle 405 separately if needed
    if (res.status === 405) {
      throw new TkrAppError(
        res.status,
        "NGSignMethodNotAllowed",
        `NGSign method not allowed: ${text}`,
      );
    }

    throw new TkrAppError(
      res.status,
      "NGSignFetchError",
      `NGSign error ${res.status}: ${text}`,
    );
  }

  return res.json() as Promise<T>;
}
