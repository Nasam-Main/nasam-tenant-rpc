import { credentials, Metadata, type ChannelCredentials } from "@grpc/grpc-js";
import {
  tenantCreateInputSchema,
  provisioningStatusInputSchema,
  provisioningStatusSchema,
  type TenantCreateInput,
  type ProvisioningStatusInput,
  type ProvisioningStatus,
} from "./schemas";
import { TenantRpcClientError, fromGrpcError } from "./errors";
import {
  TenantControlClient,
  type CreateTenantRequest,
  type GetProvisioningStatusRequest,
  type ProvisioningStatus as ProtoProvisioningStatus,
} from "./gen/nasam/tenant_control/v1/tenant_control";

export interface TenantControlGrpcClientOptions {
  credentials?: ChannelCredentials;
  deadlineMs?: number;
}

export function createTenantControlGrpcClient(
  address: string,
  options?: TenantControlGrpcClientOptions,
) {
  const creds = options?.credentials ?? credentials.createInsecure();
  const client = new TenantControlClient(address, creds);
  const defaultDeadlineMs = options?.deadlineMs ?? 10000;

  function toDomainProvisioningStatus(
    proto: ProtoProvisioningStatus,
  ): ProvisioningStatus {
    const rawStatus = String(proto.status);
    let statusStr = rawStatus;
    if (statusStr.startsWith("OPERATION_STATUS_")) {
      statusStr = statusStr.slice("OPERATION_STATUS_".length);
    }

    const domainObj: Record<string, unknown> = {
      protocolVersion: proto.protocolVersion,
      tenantId: proto.tenantId,
      operationId: proto.operationId,
      status: statusStr,
      stage: proto.stage,
      updatedAt:
        proto.updatedAt instanceof Date && !isNaN(proto.updatedAt.getTime())
          ? proto.updatedAt.toISOString()
          : typeof proto.updatedAt === "string"
          ? proto.updatedAt
          : undefined,
    };

    if (proto.failedStage !== undefined) {
      domainObj.failedStage = proto.failedStage;
    }
    if (proto.errorKey !== undefined) {
      domainObj.errorKey = proto.errorKey;
    }

    try {
      return provisioningStatusSchema.parse(domainObj);
    } catch {
      throw new TenantRpcClientError({
        status: 503,
        messageKey: "TENANT_CONTROL_UNAVAILABLE",
      });
    }
  }

  const create = async (
    input: TenantCreateInput,
    token: string,
  ): Promise<ProvisioningStatus> => {
    const parseResult = tenantCreateInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new TenantRpcClientError({
        code: "INVALID_ARGUMENT",
        status: 400,
        messageKey: "INVALID_TENANT_RPC_INPUT",
      });
    }
    const validated = parseResult.data;

    const request: CreateTenantRequest = {
      tenantId: validated.tenantId,
      operationId: validated.operationId,
      idempotencyKey: validated.idempotencyKey,
      payload: {
        slug: validated.payload.slug,
        nameEn: validated.payload.nameEn,
        nameAr: validated.payload.nameAr,
        email: validated.payload.email,
        phoneNumber: validated.payload.phoneNumber,
        moduleIds: validated.payload.moduleIds,
      },
    };

    const metadata = new Metadata();
    metadata.set("authorization", `Bearer ${token}`);

    const deadline = new Date(Date.now() + defaultDeadlineMs);

    return new Promise<ProvisioningStatus>((resolve, reject) => {
      client.createTenant(request, metadata, { deadline }, (err, response) => {
        if (err) {
          reject(fromGrpcError(err));
          return;
        }
        try {
          resolve(toDomainProvisioningStatus(response));
        } catch (domainErr) {
          reject(domainErr);
        }
      });
    });
  };

  const status = async (
    input: ProvisioningStatusInput,
    token: string,
  ): Promise<ProvisioningStatus> => {
    const parseResult = provisioningStatusInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new TenantRpcClientError({
        code: "INVALID_ARGUMENT",
        status: 400,
        messageKey: "INVALID_TENANT_RPC_INPUT",
      });
    }
    const validated = parseResult.data;

    const request: GetProvisioningStatusRequest = {
      tenantId: validated.tenantId,
      operationId: validated.operationId,
    };

    const metadata = new Metadata();
    metadata.set("authorization", `Bearer ${token}`);

    const deadline = new Date(Date.now() + defaultDeadlineMs);

    return new Promise<ProvisioningStatus>((resolve, reject) => {
      client.getProvisioningStatus(
        request,
        metadata,
        { deadline },
        (err, response) => {
          if (err) {
            reject(fromGrpcError(err));
            return;
          }
          try {
            resolve(toDomainProvisioningStatus(response));
          } catch (domainErr) {
            reject(domainErr);
          }
        },
      );
    });
  };

  const close = () => {
    client.close();
  };

  return {
    create,
    status,
    close,
  };
}
