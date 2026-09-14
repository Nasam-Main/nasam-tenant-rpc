// Re-export schemas and types
export {
  TENANT_RPC_PROTOCOL_VERSION,
  tenantCreateInputSchema,
  provisioningStatusInputSchema,
  provisioningStatusSchema,
  tenantCreateResultSchema,
  type TenantCreateInput,
  type ProvisioningStatusInput,
  type ProvisioningStatus,
} from "./schemas";

// Delegation
export {
  TENANT_RPC_PROCEDURES,
  type TenantRpcProcedure,
  TENANT_RPC_METHODS,
  type TenantRpcMethod,
  type DelegationClaims,
} from "./delegation";

// Errors and shared mapping
export {
  type TenantRpcErrorShape,
  TenantRpcClientError,
  type TenantRpcMappingEntry,
  TENANT_RPC_ERROR_MAPPINGS,
  toTenantRpcServiceError,
  fromGrpcError,
} from "./errors";

// gRPC Client
export {
  createTenantControlGrpcClient,
  type TenantControlGrpcClientOptions,
} from "./grpc-client";

// HTTP Client (deprecated)
export { createTenantControlClient } from "./http-client";

// Generated proto service definitions, server/client interfaces, and message types
export {
  TenantControlService,
  type TenantControlServer,
  TenantControlClient,
  CreateTenantRequest,
  TenantPayload,
  GetProvisioningStatusRequest,
  // The proto message shares its name with the zod-inferred domain type above.
  ProvisioningStatus as ProtoProvisioningStatus,
  OperationStatus,
  operationStatusFromJSON,
  operationStatusToJSON,
  operationStatusToNumber,
} from "./gen/nasam/tenant_control/v1/tenant_control";
