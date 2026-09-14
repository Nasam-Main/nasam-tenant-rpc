import { z } from "zod";

export const TENANT_RPC_PROTOCOL_VERSION = "1" as const;
export const TENANT_RPC_PROCEDURES = [
  "tenants.create",
  "provisioning.status",
] as const;
export type TenantRpcProcedure = (typeof TENANT_RPC_PROCEDURES)[number];

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

export interface DelegationClaims {
  iss: string;
  aud: string;
  sub: "nasam-portal";
  actorId: string;
  tenantId: string;
  procedure: TenantRpcProcedure;
  correlationId: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface TenantRpcErrorShape {
  code?: string;
  status: number;
  messageKey: string;
}

export class TenantRpcClientError extends Error {
  constructor(readonly details: TenantRpcErrorShape) {
    super(details.messageKey);
    this.name = "TenantRpcClientError";
  }
}

export function createTenantControlClient(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
) {
  const call = async <T>(
    procedure: TenantRpcProcedure,
    input: unknown,
    token: string,
    schema: z.ZodType<T>,
  ): Promise<T> => {
    const query =
      procedure === "provisioning.status"
        ? `?input=${encodeURIComponent(JSON.stringify(input))}`
        : "";
    let response: Response;
    try {
      response = await fetchImpl(
        `${baseUrl.replace(/\/$/, "")}/trpc/${procedure}${query}`,
        {
          method: procedure === "provisioning.status" ? "GET" : "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body:
            procedure === "provisioning.status"
              ? undefined
              : JSON.stringify(input),
        },
      );
    } catch {
      throw new TenantRpcClientError({
        status: 503,
        messageKey: "TENANT_CONTROL_UNAVAILABLE",
      });
    }

    const body = (await response.json().catch(() => undefined)) as
      | TrpcEnvelope
      | undefined;
    if (!response.ok || body?.error) {
      throw new TenantRpcClientError({
        code: body?.error?.data?.code,
        status: body?.error?.data?.httpStatus ?? response.status,
        messageKey:
          body?.error?.data?.messageKey ??
          body?.error?.message ??
          "TENANT_CONTROL_UNAVAILABLE",
      });
    }
    return schema.parse(unwrapResult(body?.result?.data));
  };

  return {
    create: (input: TenantCreateInput, token: string) =>
      call("tenants.create", input, token, tenantCreateResultSchema),
    status: (input: ProvisioningStatusInput, token: string) =>
      call("provisioning.status", input, token, provisioningStatusSchema),
  };
}

interface TrpcEnvelope {
  result?: { data?: unknown };
  error?: {
    data?: { code?: string; httpStatus?: number; messageKey?: string };
    message?: string;
  };
}

function unwrapResult(data: unknown): unknown {
  if (typeof data === "object" && data !== null && "json" in data) {
    return data.json;
  }
  return data;
}
