import { credentials, Metadata, type ChannelCredentials } from "@grpc/grpc-js";
import {
  tenantCreateInputSchema,
  tenantUpdateInputSchema,
  tenantRecordSchema,
  provisioningStatusInputSchema,
  provisioningStatusSchema,
  type TenantCreateInput,
  type TenantUpdateInput,
  type TenantRecordResult,
  type ProvisioningStatusInput,
  type ProvisioningStatus,
  tenantGetInputSchema,
  type TenantGetInput,
  tenantListInputSchema,
  tenantListResultSchema,
  type TenantListInput,
  type TenantListResult,
  moduleListResultSchema,
  moduleRecordSchema,
  moduleUpdatePriceInputSchema,
  type ModuleListResult,
  type ModuleRecordResult,
  type ModuleUpdatePriceInput,
  subscriptionListInputSchema,
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
  subscriptionListResultSchema,
  subscriptionRecordSchema,
  subscriptionCreateInputSchema,
  type SubscriptionListInput,
  type SubscriptionListResult,
  type SubscriptionRecordResult,
  type SubscriptionCreateInput,
} from "./schemas";
import { TenantRpcClientError, fromGrpcError } from "./errors";
import {
  TenantControlClient,
  type CreateTenantRequest,
  type UpdateTenantRequest,
  type TenantRecord,
  type GetProvisioningStatusRequest,
  type ProvisioningStatus as ProtoProvisioningStatus,
  type GetTenantRequest,
  type ListTenantsRequest,
  type ListTenantsResponse,
  type ListModulesRequest,
  type ListModulesResponse,
  type ModuleRecord,
  type UpdateModulePriceRequest,
  type ListSubscriptionsRequest,
  type ListSubscriptionsResponse,
  type SubscriptionRecord,
  type CreateSubscriptionRequest,
  type AccountAdminRecord,
  type ListAccountAdminsRequest,
  type ListAccountAdminsResponse,
  type GetAccountAdminRequest,
  type CreateAccountAdminRequest,
  type UpdateAccountAdminRequest,
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
        branding: validated.payload.branding,
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

  function toDomainTenantRecord(response: TenantRecord): TenantRecordResult {
    return tenantRecordSchema.parse({
      id: response.id,
      slug: response.slug,
      nameEn: response.nameEn,
      nameAr: response.nameAr,
      email: response.email,
      phoneNumber: response.phoneNumber,
      status: response.status,
      createdAt: response.createdAt?.toISOString(),
      updatedAt: response.updatedAt?.toISOString(),
      branding: response.logoUrl || response.primaryColor
        ? {
            ...(response.logoUrl ? { logoUrl: response.logoUrl } : {}),
            ...(response.primaryColor
              ? { primaryColor: response.primaryColor }
              : {}),
          }
        : undefined,
    });
  }

  const update = async (
    input: TenantUpdateInput,
    token: string,
  ): Promise<TenantRecordResult> => {
    const validated = tenantUpdateInputSchema.parse(input);
    const metadata = new Metadata();
    metadata.set("authorization", `Bearer ${token}`);
    const deadline = new Date(Date.now() + defaultDeadlineMs);
    const request: UpdateTenantRequest = {
      tenantId: validated.tenantId,
      nameEn: validated.nameEn,
      nameAr: validated.nameAr,
      email: validated.email,
      phoneNumber: validated.phoneNumber,
      branding: validated.branding,
    };
    return new Promise<TenantRecordResult>((resolve, reject) => {
      client.updateTenant(request, metadata, { deadline }, (err, response: TenantRecord) => {
        if (err) return reject(fromGrpcError(err));
        try {
          resolve(toDomainTenantRecord(response));
        } catch (error) {
          reject(error);
        }
      });
    });
  };

  const get = async (
    input: TenantGetInput,
    token: string,
  ): Promise<TenantRecordResult> => {
    const parseResult = tenantGetInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new TenantRpcClientError({
        code: "INVALID_ARGUMENT",
        status: 400,
        messageKey: "INVALID_TENANT_RPC_INPUT",
      });
    }
    const metadata = new Metadata();
    metadata.set("authorization", `Bearer ${token}`);
    const deadline = new Date(Date.now() + defaultDeadlineMs);
    const request: GetTenantRequest = { tenantId: parseResult.data.tenantId };
    return new Promise<TenantRecordResult>((resolve, reject) => {
      client.getTenant(request, metadata, { deadline }, (err, response: TenantRecord) => {
        if (err) return reject(fromGrpcError(err));
        try {
          resolve(toDomainTenantRecord(response));
        } catch (error) {
          reject(error);
        }
      });
    });
  };

  /** Archives or restores one tenant; both answer with its registry record. */
  const tenantTransition = (
    method: "archiveTenant" | "restoreTenant",
  ) => async (input: TenantGetInput, token: string): Promise<TenantRecordResult> => {
    const validated = parseInput<TenantGetInput>(tenantGetInputSchema, input);
    return unary(
      client[method] as unknown as UnaryMethod<GetTenantRequest, TenantRecord>,
      { tenantId: validated.tenantId },
      token,
      toDomainTenantRecord,
    );
  };
  const archive = tenantTransition("archiveTenant");
  const restore = tenantTransition("restoreTenant");

  const list = async (
    input: TenantListInput,
    token: string,
  ): Promise<TenantListResult> => {
    const validated = tenantListInputSchema.parse(input);
    const metadata = new Metadata();
    metadata.set("authorization", `Bearer ${token}`);
    const deadline = new Date(Date.now() + defaultDeadlineMs);
    return new Promise<TenantListResult>((resolve, reject) => {
      client.listTenants(
        { page: validated.page, limit: validated.limit } as ListTenantsRequest,
        metadata,
        { deadline },
        (err, response: ListTenantsResponse) => {
          if (err) return reject(fromGrpcError(err));
          try {
            resolve(tenantListResultSchema.parse({
              data: response.tenants.map((tenant) => ({
                id: tenant.id, slug: tenant.slug, nameEn: tenant.nameEn,
                nameAr: tenant.nameAr, email: tenant.email,
                phoneNumber: tenant.phoneNumber, status: tenant.status,
                createdAt: tenant.createdAt?.toISOString(),
                updatedAt: tenant.updatedAt?.toISOString(),
              })),
              meta: { page: response.page, limit: response.limit, total: response.total, totalPages: response.totalPages },
            }));
          } catch (error) { reject(error); }
        },
      );
    });
  };

  const close = () => {
    client.close();
  };

  function toDomainModule(module: ModuleRecord): ModuleRecordResult {
    return moduleRecordSchema.parse({
      id: module.id, slug: module.slug, nameEn: module.nameEn, nameAr: module.nameAr,
      descriptionEn: module.descriptionEn, descriptionAr: module.descriptionAr,
      purchasingPrice: module.purchasingPrice, sellingPrice: module.sellingPrice,
      createdAt: module.createdAt?.toISOString(), updatedAt: module.updatedAt?.toISOString(),
    });
  }

  const listModules = async (token: string): Promise<ModuleListResult> => {
    const metadata = new Metadata();
    metadata.set("authorization", `Bearer ${token}`);
    const deadline = new Date(Date.now() + defaultDeadlineMs);
    return new Promise<ModuleListResult>((resolve, reject) => {
      client.listModules({} as ListModulesRequest, metadata, { deadline }, (err, response: ListModulesResponse) => {
        if (err) return reject(fromGrpcError(err));
        try {
          resolve(moduleListResultSchema.parse({ data: response.modules.map(toDomainModule) }));
        } catch (error) { reject(error); }
      });
    });
  };

  function toDomainSubscription(subscription: SubscriptionRecord): SubscriptionRecordResult {
    return subscriptionRecordSchema.parse({
      id: subscription.id, organizationId: subscription.organizationId,
      organizationNameEn: subscription.organizationNameEn, organizationNameAr: subscription.organizationNameAr,
      modules: subscription.modules.map((module) => ({ id: module.id, moduleId: module.moduleId, nameEn: module.nameEn, nameAr: module.nameAr, descriptionEn: module.descriptionEn, descriptionAr: module.descriptionAr, price: module.price, startDate: module.startDate?.toISOString() ?? null, endDate: module.endDate?.toISOString() ?? null, status: module.status })),
      totalPrice: subscription.totalPrice, currency: subscription.currency, status: subscription.status, createdAt: subscription.createdAt?.toISOString(),
    });
  }

  const listSubscriptions = async (input: SubscriptionListInput, token: string): Promise<SubscriptionListResult> => {
    const validated = subscriptionListInputSchema.parse(input);
    const metadata = new Metadata();
    metadata.set("authorization", `Bearer ${token}`);
    const deadline = new Date(Date.now() + defaultDeadlineMs);
    return new Promise<SubscriptionListResult>((resolve, reject) => {
      client.listSubscriptions({ page: validated.page, limit: validated.limit, status: validated.status, search: validated.search } as ListSubscriptionsRequest, metadata, { deadline }, (err, response: ListSubscriptionsResponse) => {
        if (err) return reject(fromGrpcError(err));
        try {
          resolve(subscriptionListResultSchema.parse({
            data: response.subscriptions.map(toDomainSubscription),
            meta: { currentPage: response.currentPage, totalPages: response.totalPages, totalCount: response.totalCount },
          }));
        } catch (error) { reject(error); }
      });
    });
  };

  function parseInput<T>(
    schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } },
    input: unknown,
  ): T {
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new TenantRpcClientError({
        code: "INVALID_ARGUMENT",
        status: 400,
        messageKey: "INVALID_TENANT_RPC_INPUT",
      });
    }
    return result.data;
  }

  function toDomainAccountAdmin(admin: AccountAdminRecord): AccountAdminRecordResult {
    return accountAdminRecordSchema.parse({
      id: admin.id,
      tenantId: admin.tenantId,
      tenantNameEn: admin.tenantNameEn,
      tenantNameAr: admin.tenantNameAr,
      username: admin.username,
      email: admin.email,
      phoneNumber: admin.phoneNumber,
      nameEn: admin.nameEn,
      nameAr: admin.nameAr,
      status: admin.status,
      createdAt: admin.createdAt?.toISOString(),
      updatedAt: admin.updatedAt?.toISOString(),
      archivedAt: admin.archivedAt?.toISOString(),
    });
  }

  type UnaryMethod<Req, Res> = (
    request: Req,
    metadata: Metadata,
    options: { deadline: Date },
    callback: (err: unknown, response: Res) => void,
  ) => unknown;

  function unary<Req, Res, Out>(
    method: UnaryMethod<Req, Res>,
    request: Req,
    token: string,
    map: (response: Res) => Out,
  ): Promise<Out> {
    const metadata = new Metadata();
    metadata.set("authorization", `Bearer ${token}`);
    const deadline = new Date(Date.now() + defaultDeadlineMs);
    return new Promise<Out>((resolve, reject) => {
      method.call(client, request, metadata, { deadline }, (err, response) => {
        if (err) return reject(fromGrpcError(err));
        try {
          resolve(map(response));
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  const listAccountAdmins = async (
    input: AccountAdminListInput,
    token: string,
  ): Promise<AccountAdminListResult> => {
    const validated = parseInput<AccountAdminListInput>(accountAdminListInputSchema, input);
    return unary(
      client.listAccountAdmins as unknown as UnaryMethod<ListAccountAdminsRequest, ListAccountAdminsResponse>,
      validated,
      token,
      (response) => accountAdminListResultSchema.parse({
        data: response.admins.map(toDomainAccountAdmin),
        meta: {
          page: response.page,
          limit: response.limit,
          total: response.total,
          totalPages: response.totalPages,
        },
      }),
    );
  };

  const getAccountAdmin = async (
    input: AccountAdminGetInput,
    token: string,
  ): Promise<AccountAdminRecordResult> => {
    const validated = parseInput<AccountAdminGetInput>(accountAdminGetInputSchema, input);
    return unary(
      client.getAccountAdmin as unknown as UnaryMethod<GetAccountAdminRequest, AccountAdminRecord>,
      validated,
      token,
      toDomainAccountAdmin,
    );
  };

  const createAccountAdmin = async (
    input: AccountAdminCreateInput,
    token: string,
  ): Promise<AccountAdminRecordResult> => {
    const validated = parseInput<AccountAdminCreateInput>(accountAdminCreateInputSchema, input);
    return unary(
      client.createAccountAdmin as unknown as UnaryMethod<CreateAccountAdminRequest, AccountAdminRecord>,
      validated,
      token,
      toDomainAccountAdmin,
    );
  };

  const deleteAccountAdmin = async (
    input: AccountAdminGetInput,
    token: string,
  ): Promise<AccountAdminRecordResult> => {
    const validated = parseInput<AccountAdminGetInput>(accountAdminGetInputSchema, input);
    return unary(
      client.deleteAccountAdmin as unknown as UnaryMethod<GetAccountAdminRequest, AccountAdminRecord>,
      validated,
      token,
      toDomainAccountAdmin,
    );
  };

  const restoreAccountAdmin = async (
    input: AccountAdminGetInput,
    token: string,
  ): Promise<AccountAdminRecordResult> => {
    const validated = parseInput<AccountAdminGetInput>(accountAdminGetInputSchema, input);
    return unary(
      client.restoreAccountAdmin as unknown as UnaryMethod<GetAccountAdminRequest, AccountAdminRecord>,
      validated,
      token,
      toDomainAccountAdmin,
    );
  };

  const updateModulePrice = async (
    input: ModuleUpdatePriceInput,
    token: string,
  ): Promise<ModuleRecordResult> => {
    const validated = parseInput<ModuleUpdatePriceInput>(moduleUpdatePriceInputSchema, input);
    return unary(
      client.updateModulePrice as unknown as UnaryMethod<UpdateModulePriceRequest, ModuleRecord>,
      validated,
      token,
      toDomainModule,
    );
  };

  const createSubscription = async (
    input: SubscriptionCreateInput,
    token: string,
  ): Promise<SubscriptionRecordResult> => {
    const validated = parseInput<SubscriptionCreateInput>(subscriptionCreateInputSchema, input);
    const request: CreateSubscriptionRequest = {
      tenantId: validated.tenantId,
      modules: validated.modules.map((line) => ({
        moduleId: line.moduleId,
        price: line.price,
        startDate: line.startDate ? new Date(line.startDate) : undefined,
        endDate: line.endDate ? new Date(line.endDate) : undefined,
      })),
    };
    return unary(
      client.createSubscription as unknown as UnaryMethod<CreateSubscriptionRequest, SubscriptionRecord>,
      request,
      token,
      toDomainSubscription,
    );
  };

  const updateAccountAdmin = async (
    input: AccountAdminUpdateInput,
    token: string,
  ): Promise<AccountAdminRecordResult> => {
    const validated = parseInput<AccountAdminUpdateInput>(accountAdminUpdateInputSchema, input);
    return unary(
      client.updateAccountAdmin as unknown as UnaryMethod<UpdateAccountAdminRequest, AccountAdminRecord>,
      validated,
      token,
      toDomainAccountAdmin,
    );
  };

  return {
    create,
    update,
    get,
    archive,
    restore,
    status,
    list,
    listModules,
    updateModulePrice,
    listSubscriptions,
    createSubscription,
    listAccountAdmins,
    getAccountAdmin,
    createAccountAdmin,
    updateAccountAdmin,
    deleteAccountAdmin,
    restoreAccountAdmin,
    close,
  };
}
