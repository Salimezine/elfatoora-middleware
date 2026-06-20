import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  PUBLIC_BASE_URL: z.string(),
  TTN_HANDLING_MODE: z.enum(["WS", "SFTP"]),
  TTN_SOAP_URL: z
    .string()
    .default("http://elfatoura.tradenet.com.tn:80/ElfatouraServices/EfactService"),
  TTN_SOAP_TIMEOUT: z.coerce.number().positive().default(10000),
  TTN_SFTP_HOST: z.string().default(""),
  TTN_SFTP_PORT: z.coerce.number().positive().default(22),
  GLOBAL_API_KEY: z.string().min(1).default("dev-global-api-key"),
  NGSIGN_SKIP: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
});

let envVars: z.infer<typeof envSchema>;

export function validateRequiredEnvVars() {
  envVars = envSchema.parse(process.env);
}

export function env() {
  if (!envVars) {
    envVars = envSchema.parse(process.env);
  }
  return envVars;
}

export function publicUrl(path: string): string {
  const baseUrl = env().PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error("PUBLIC_BASE_URL is not defined in environment variables.");
  }
  return new URL(path, baseUrl).toString();
}
