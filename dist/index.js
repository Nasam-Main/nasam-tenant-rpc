"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantRpcClientError = exports.tenantCreateResultSchema = exports.provisioningStatusSchema = exports.provisioningStatusInputSchema = exports.tenantCreateInputSchema = exports.TENANT_RPC_PROCEDURES = exports.TENANT_RPC_PROTOCOL_VERSION = void 0;
exports.createTenantControlClient = createTenantControlClient;
const zod_1 = require("zod");
exports.TENANT_RPC_PROTOCOL_VERSION = "1";
exports.TENANT_RPC_PROCEDURES = [
    "tenants.create",
    "provisioning.status",
];
const uuid = zod_1.z.string().uuid();
exports.tenantCreateInputSchema = zod_1.z.object({
    tenantId: uuid,
    operationId: uuid,
    idempotencyKey: zod_1.z.string().min(1).max(128),
    payload: zod_1.z.object({
        slug: zod_1.z
            .string()
            .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)
            .max(63),
        nameEn: zod_1.z.string().trim().min(1).max(150),
        nameAr: zod_1.z.string().trim().min(1).max(150),
        email: zod_1.z.string().email().max(255).optional(),
        phoneNumber: zod_1.z.string().min(1).max(20).optional(),
        moduleIds: zod_1.z.array(uuid).max(32).default([]),
    }),
});
exports.provisioningStatusInputSchema = zod_1.z.object({
    tenantId: uuid,
    operationId: uuid,
});
exports.provisioningStatusSchema = zod_1.z.object({
    protocolVersion: zod_1.z.literal(exports.TENANT_RPC_PROTOCOL_VERSION),
    tenantId: uuid,
    operationId: uuid,
    status: zod_1.z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]),
    stage: zod_1.z.string(),
    failedStage: zod_1.z.string().optional(),
    errorKey: zod_1.z.string().optional(),
    updatedAt: zod_1.z.string(),
});
exports.tenantCreateResultSchema = exports.provisioningStatusSchema;
class TenantRpcClientError extends Error {
    details;
    constructor(details) {
        super(details.messageKey);
        this.details = details;
        this.name = "TenantRpcClientError";
    }
}
exports.TenantRpcClientError = TenantRpcClientError;
function createTenantControlClient(baseUrl, fetchImpl = fetch) {
    const call = async (procedure, input, token, schema) => {
        const query = procedure === "provisioning.status"
            ? `?input=${encodeURIComponent(JSON.stringify(input))}`
            : "";
        let response;
        try {
            response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/trpc/${procedure}${query}`, {
                method: procedure === "provisioning.status" ? "GET" : "POST",
                headers: {
                    authorization: `Bearer ${token}`,
                    "content-type": "application/json",
                },
                body: procedure === "provisioning.status"
                    ? undefined
                    : JSON.stringify(input),
            });
        }
        catch {
            throw new TenantRpcClientError({
                status: 503,
                messageKey: "TENANT_CONTROL_UNAVAILABLE",
            });
        }
        const body = (await response.json().catch(() => undefined));
        if (!response.ok || body?.error) {
            throw new TenantRpcClientError({
                code: body?.error?.data?.code,
                status: body?.error?.data?.httpStatus ?? response.status,
                messageKey: body?.error?.data?.messageKey ??
                    body?.error?.message ??
                    "TENANT_CONTROL_UNAVAILABLE",
            });
        }
        return schema.parse(unwrapResult(body?.result?.data));
    };
    return {
        create: (input, token) => call("tenants.create", input, token, exports.tenantCreateResultSchema),
        status: (input, token) => call("provisioning.status", input, token, exports.provisioningStatusSchema),
    };
}
function unwrapResult(data) {
    if (typeof data === "object" && data !== null && "json" in data) {
        return data.json;
    }
    return data;
}
//# sourceMappingURL=index.js.map