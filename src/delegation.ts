export const TENANT_RPC_PROCEDURES = [
  "tenants.create",
  "tenants.update",
  "provisioning.status",
  "tenants.get",
  "tenants.archive",
  "tenants.restore",
  "tenants.list",
  "modules.list",
  "subscriptions.list",
  "subscriptions.create",
  "accountAdmins.list",
  "accountAdmins.get",
  "accountAdmins.create",
  "accountAdmins.update",
  "accountAdmins.delete",
  "accountAdmins.restore",
] as const;

export type TenantRpcProcedure = (typeof TENANT_RPC_PROCEDURES)[number];

export const TENANT_RPC_METHODS = {
  "/nasam.tenant_control.v1.TenantControl/CreateTenant": "tenants.create",
  "/nasam.tenant_control.v1.TenantControl/UpdateTenant": "tenants.update",
  "/nasam.tenant_control.v1.TenantControl/GetProvisioningStatus":
    "provisioning.status",
  "/nasam.tenant_control.v1.TenantControl/GetTenant": "tenants.get",
  "/nasam.tenant_control.v1.TenantControl/ArchiveTenant": "tenants.archive",
  "/nasam.tenant_control.v1.TenantControl/RestoreTenant": "tenants.restore",
  "/nasam.tenant_control.v1.TenantControl/ListTenants": "tenants.list",
  "/nasam.tenant_control.v1.TenantControl/ListModules": "modules.list",
  "/nasam.tenant_control.v1.TenantControl/ListSubscriptions": "subscriptions.list",
  "/nasam.tenant_control.v1.TenantControl/CreateSubscription": "subscriptions.create",
  "/nasam.tenant_control.v1.TenantControl/ListAccountAdmins": "accountAdmins.list",
  "/nasam.tenant_control.v1.TenantControl/GetAccountAdmin": "accountAdmins.get",
  "/nasam.tenant_control.v1.TenantControl/CreateAccountAdmin": "accountAdmins.create",
  "/nasam.tenant_control.v1.TenantControl/UpdateAccountAdmin": "accountAdmins.update",
  "/nasam.tenant_control.v1.TenantControl/DeleteAccountAdmin": "accountAdmins.delete",
  "/nasam.tenant_control.v1.TenantControl/RestoreAccountAdmin": "accountAdmins.restore",
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
