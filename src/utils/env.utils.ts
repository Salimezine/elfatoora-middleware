const requiredVars = ["PUBLIC_BASE_URL", "DATABASE_URL"];

export function validateRequiredEnvVars(): void {
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`,
    );
  }
}

export function publicUrl(path: string): string {
  const baseUrl = process.env.PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error("PUBLIC_BASE_URL is not defined in environment variables.");
  }
  return new URL(path, baseUrl).toString();
}
