export const TENANT_RPC_PROCEDURES = [
  "tenants.create",
  "provisioning.status",
] as const;

export type TenantRpcProcedure = (typeof TENANT_RPC_PROCEDURES)[number];

export const TENANT_RPC_METHODS = {
  "/nasam.tenant_control.v1.TenantControl/CreateTenant": "tenants.create",
  "/nasam.tenant_control.v1.TenantControl/GetProvisioningStatus":
    "provisioning.status",
} as const satisfies Record<string, TenantRpcProcedure>;

export type TenantRpcMethod = keyof typeof TENANT_RPC_METHODS;

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
