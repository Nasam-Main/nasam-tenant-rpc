import type { TenantCreateInput, ProvisioningStatusInput } from "./schemas";
import type { createTenantControlGrpcClient } from "./grpc-client";

type GrpcClient = ReturnType<typeof createTenantControlGrpcClient>;

// Client method parameter types
type CreateParam = Parameters<GrpcClient["create"]>[0];
type StatusParam = Parameters<GrpcClient["status"]>[0];

// Verify that TenantCreateInput is assignable to create's first argument
const _checkTenantCreateParam: CreateParam = {} as TenantCreateInput;

// Verify that ProvisioningStatusInput is assignable to status's first argument
const _checkProvisioningStatusParam: StatusParam =
  {} as ProvisioningStatusInput;

void _checkTenantCreateParam;
void _checkProvisioningStatusParam;
