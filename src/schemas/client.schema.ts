import { z } from "zod";

export const ClientTaxIdParamSchema = z.object({
  taxId: z.string().trim().min(1).max(35),
});

export const CreateClientSchema = z.object({
  name: z.string().trim().min(1).max(255),
  taxId: z.string().trim().min(1).max(35),
  api: z.string().trim().min(1).max(100),
  mode: z.enum(["test", "prod"]).optional(),
  ngsign_token: z.string().trim().min(1).optional(),
  ngsign_signer_email: z.email().optional(),
  ttn_login: z.string().trim().min(1).optional(),
  ttn_password: z.string().trim().min(1).optional(),
});

export const UpdateClientSchema = z
  .object({
    mode: z.enum(["test", "prod"]).optional(),
    ngsign_token: z.string().trim().min(1).optional(),
    ngsign_signer_email: z.email().optional(),
    ttn_login: z.union([z.string().trim().min(1), z.null()]).optional(),
    ttn_password: z.union([z.string().trim().min(1), z.null()]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export type CreateClientInput = z.infer<typeof CreateClientSchema>;
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;
