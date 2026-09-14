import { z } from "zod";
import {
  tenantCreateResultSchema,
  provisioningStatusSchema,
  type TenantCreateInput,
  type ProvisioningStatusInput,
} from "./schemas";
import { type TenantRpcProcedure } from "./delegation";
import { TenantRpcClientError } from "./errors";

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

/**
 * Creates a fetch-based tRPC HTTP client for tenant control.
 *
 * @deprecated Deprecated in 0.2.0; will be removed in 1.0.0. Use {@link createTenantControlGrpcClient} instead.
 */
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
