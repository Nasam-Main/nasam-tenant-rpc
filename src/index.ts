// Re-export schemas and types
export {
  TENANT_RPC_PROTOCOL_VERSION,
  tenantCreateInputSchema,
  tenantUpdateInputSchema,
  tenantRecordSchema,
  provisioningStatusInputSchema,
  provisioningStatusSchema,
  tenantGetInputSchema,
  tenantListInputSchema,
  tenantListResultSchema,
  moduleListResultSchema,
  moduleRecordSchema,
  moduleUpdatePriceInputSchema,
  subscriptionListInputSchema,
  subscriptionListResultSchema,
  subscriptionRecordSchema,
  subscriptionCreateInputSchema,
  tenantCreateResultSchema,
  accountAdminListInputSchema,
  accountAdminGetInputSchema,
  accountAdminCreateInputSchema,
  accountAdminUpdateInputSchema,
  accountAdminRecordSchema,
  accountAdminListResultSchema,
  type AccountAdminListInput,
  type AccountAdminGetInput,
  type AccountAdminCreateInput,
  type AccountAdminUpdateInput,
  type AccountAdminRecordResult,
  type AccountAdminListResult,
  type TenantCreateInput,
  type TenantUpdateInput,
  type TenantRecordResult,
  type ProvisioningStatusInput,
  type ProvisioningStatus,
  type TenantGetInput,
  type TenantListInput,
  type TenantListResult,
  type ModuleListResult,
  type ModuleRecordResult,
  type ModuleUpdatePriceInput,
  type SubscriptionListInput,
  type SubscriptionListResult,
  type SubscriptionRecordResult,
  type SubscriptionCreateInput,
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
  UpdateTenantRequest,
  TenantPayload,
  GetProvisioningStatusRequest,
  GetTenantRequest,
  ListTenantsRequest,
  ListTenantsResponse,
  TenantRecord,
  ListModulesRequest,
  ListModulesResponse,
  ModuleRecord,
  UpdateModulePriceRequest,
  ListSubscriptionsRequest,
  ListSubscriptionsResponse,
  SubscriptionRecord,
  SubscriptionModuleRecord,
  CreateSubscriptionRequest,
  CreateSubscriptionModuleLine,
  AccountAdminRecord,
  ListAccountAdminsRequest,
  ListAccountAdminsResponse,
  GetAccountAdminRequest,
  CreateAccountAdminRequest,
  UpdateAccountAdminRequest,
  // The proto message shares its name with the zod-inferred domain type above.
  ProvisioningStatus as ProtoProvisioningStatus,
  OperationStatus,
  operationStatusFromJSON,
  operationStatusToJSON,
  operationStatusToNumber,
} from "./gen/nasam/tenant_control/v1/tenant_control";
