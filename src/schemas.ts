import { z } from "zod";

export const TENANT_RPC_PROTOCOL_VERSION = "1" as const;

const uuid = z.string().uuid();

export const tenantCreateInputSchema = z.object({
  tenantId: uuid,
  operationId: uuid,
  idempotencyKey: z.string().min(1).max(128),
  payload: z.object({
    slug: z
      .string()
      .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)
      .max(63),
    nameEn: z.string().trim().min(1).max(150),
    nameAr: z.string().trim().min(1).max(150),
    email: z.string().email().max(255).optional(),
    phoneNumber: z.string().min(1).max(20).optional(),
    moduleIds: z.array(uuid).max(32).default([]),
  }),
});

export const provisioningStatusInputSchema = z.object({
  tenantId: uuid,
  operationId: uuid,
});

export const provisioningStatusSchema = z.object({
  protocolVersion: z.literal(TENANT_RPC_PROTOCOL_VERSION),
  tenantId: uuid,
  operationId: uuid,
  status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]),
  stage: z.string(),
  failedStage: z.string().optional(),
  errorKey: z.string().optional(),
  updatedAt: z.string(),
});

export const tenantCreateResultSchema = provisioningStatusSchema;
export type TenantCreateInput = z.infer<typeof tenantCreateInputSchema>;
export type ProvisioningStatusInput = z.infer<
  typeof provisioningStatusInputSchema
>;
export type ProvisioningStatus = z.infer<typeof provisioningStatusSchema>;
