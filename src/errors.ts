import { Metadata, status, type ServiceError } from "@grpc/grpc-js";

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

export interface TenantRpcMappingEntry {
  grpcCode: number;
  grpcName: string;
  httpStatus: number;
}

export const TENANT_RPC_ERROR_MAPPINGS: Record<string, TenantRpcMappingEntry> = {
  IDEMPOTENCY_KEY_REUSED: {
    grpcCode: status.ALREADY_EXISTS,
    grpcName: "ALREADY_EXISTS",
    httpStatus: 409,
  },
  TENANT_ALREADY_EXISTS: {
    grpcCode: status.ALREADY_EXISTS,
    grpcName: "ALREADY_EXISTS",
    httpStatus: 409,
  },
  TENANT_SLUG_ALREADY_EXISTS: {
    grpcCode: status.ALREADY_EXISTS,
    grpcName: "ALREADY_EXISTS",
    httpStatus: 409,
  },
  MODULE_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    grpcName: "NOT_FOUND",
    httpStatus: 404,
  },
  CORE_MODULE_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    grpcName: "NOT_FOUND",
    httpStatus: 404,
  },
  PROVISIONING_OPERATION_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    grpcName: "NOT_FOUND",
    httpStatus: 404,
  },
  INVALID_DELEGATION_TOKEN: {
    grpcCode: status.UNAUTHENTICATED,
    grpcName: "UNAUTHENTICATED",
    httpStatus: 401,
  },
  TENANT_DELEGATION_MISMATCH: {
    grpcCode: status.PERMISSION_DENIED,
    grpcName: "PERMISSION_DENIED",
    httpStatus: 403,
  },
  INVALID_TENANT_RPC_INPUT: {
    grpcCode: status.INVALID_ARGUMENT,
    grpcName: "INVALID_ARGUMENT",
    httpStatus: 400,
  },
};

const GRPC_CODE_TO_HTTP_STATUS: Record<number, number> = {
  [status.ALREADY_EXISTS]: 409,
  [status.NOT_FOUND]: 404,
  [status.UNAUTHENTICATED]: 401,
  [status.PERMISSION_DENIED]: 403,
  [status.INVALID_ARGUMENT]: 400,
  [status.INTERNAL]: 500,
};

export function toTenantRpcServiceError(messageKey: string): ServiceError {
  const mapping = Object.prototype.hasOwnProperty.call(
    TENANT_RPC_ERROR_MAPPINGS,
    messageKey,
  )
    ? TENANT_RPC_ERROR_MAPPINGS[messageKey]
    : undefined;

  const effectiveKey = mapping ? messageKey : "TENANT_CONTROL_UNAVAILABLE";
  const grpcCode = mapping ? mapping.grpcCode : status.INTERNAL;

  const metadata = new Metadata();
  metadata.set("x-message-key", effectiveKey);

  const error = new Error(effectiveKey) as ServiceError;
  error.name = "ServiceError";
  error.code = grpcCode;
  error.details = effectiveKey;
  error.metadata = metadata;
  return error;
}

export function fromGrpcError(error: unknown): TenantRpcClientError {
  if (error instanceof TenantRpcClientError) {
    return error;
  }

  let rawKey: string | undefined;
  let grpcCode: number | undefined;
  let codeName: string | undefined;

  if (error && typeof error === "object") {
    const err = error as Record<string, any>;
    if (err.metadata) {
      if (typeof err.metadata.get === "function") {
        const values = err.metadata.get("x-message-key");
        if (values && values.length > 0) {
          const val = values[0];
          rawKey = typeof val === "string" ? val : val.toString("utf8");
        }
      } else if (typeof err.metadata["x-message-key"] === "string") {
        rawKey = err.metadata["x-message-key"];
      }
    }

    if (
      !rawKey &&
      typeof err.details === "string" &&
      /^[A-Z0-9_]+$/.test(err.details)
    ) {
      rawKey = err.details;
    }

    if (typeof err.code === "number") {
      grpcCode = err.code;
      codeName = (status as any)[err.code];
    } else if (typeof err.code === "string") {
      codeName = err.code;
      grpcCode = (status as any)[err.code];
    }
  }

  // gRPC UNAVAILABLE, DEADLINE_EXCEEDED, CANCELLED, UNKNOWN and any unmapped code -> status 503, messageKey TENANT_CONTROL_UNAVAILABLE.
  const is503 =
    grpcCode === status.UNAVAILABLE ||
    grpcCode === status.DEADLINE_EXCEEDED ||
    grpcCode === status.CANCELLED ||
    grpcCode === status.UNKNOWN ||
    grpcCode === undefined ||
    !Object.prototype.hasOwnProperty.call(GRPC_CODE_TO_HTTP_STATUS, grpcCode);

  if (is503) {
    return new TenantRpcClientError({
      code: codeName ?? "UNKNOWN",
      status: 503,
      messageKey: "TENANT_CONTROL_UNAVAILABLE",
    });
  }

  const mapping =
    rawKey &&
    Object.prototype.hasOwnProperty.call(TENANT_RPC_ERROR_MAPPINGS, rawKey)
      ? TENANT_RPC_ERROR_MAPPINGS[rawKey]
      : undefined;

  if (mapping) {
    return new TenantRpcClientError({
      code: codeName ?? mapping.grpcName,
      status: mapping.httpStatus,
      messageKey: rawKey!,
    });
  }

  const httpStatus = GRPC_CODE_TO_HTTP_STATUS[grpcCode!];
  return new TenantRpcClientError({
    code: codeName ?? "INTERNAL",
    status: httpStatus ?? 500,
    messageKey: "TENANT_CONTROL_UNAVAILABLE",
  });
}
