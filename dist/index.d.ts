import { z } from "zod";
export declare const TENANT_RPC_PROTOCOL_VERSION: "1";
export declare const TENANT_RPC_PROCEDURES: readonly ["tenants.create", "provisioning.status"];
export type TenantRpcProcedure = (typeof TENANT_RPC_PROCEDURES)[number];
export declare const tenantCreateInputSchema: z.ZodObject<{
    tenantId: z.ZodString;
    operationId: z.ZodString;
    idempotencyKey: z.ZodString;
    payload: z.ZodObject<{
        slug: z.ZodString;
        nameEn: z.ZodString;
        nameAr: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
        phoneNumber: z.ZodOptional<z.ZodString>;
        moduleIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        slug: string;
        nameEn: string;
        nameAr: string;
        moduleIds: string[];
        email?: string | undefined;
        phoneNumber?: string | undefined;
    }, {
        slug: string;
        nameEn: string;
        nameAr: string;
        email?: string | undefined;
        phoneNumber?: string | undefined;
        moduleIds?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    operationId: string;
    idempotencyKey: string;
    payload: {
        slug: string;
        nameEn: string;
        nameAr: string;
        moduleIds: string[];
        email?: string | undefined;
        phoneNumber?: string | undefined;
    };
}, {
    tenantId: string;
    operationId: string;
    idempotencyKey: string;
    payload: {
        slug: string;
        nameEn: string;
        nameAr: string;
        email?: string | undefined;
        phoneNumber?: string | undefined;
        moduleIds?: string[] | undefined;
    };
}>;
export declare const provisioningStatusInputSchema: z.ZodObject<{
    tenantId: z.ZodString;
    operationId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    operationId: string;
}, {
    tenantId: string;
    operationId: string;
}>;
export declare const provisioningStatusSchema: z.ZodObject<{
    protocolVersion: z.ZodLiteral<"1">;
    tenantId: z.ZodString;
    operationId: z.ZodString;
    status: z.ZodEnum<["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]>;
    stage: z.ZodString;
    failedStage: z.ZodOptional<z.ZodString>;
    errorKey: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    operationId: string;
    status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
    protocolVersion: "1";
    stage: string;
    updatedAt: string;
    failedStage?: string | undefined;
    errorKey?: string | undefined;
}, {
    tenantId: string;
    operationId: string;
    status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
    protocolVersion: "1";
    stage: string;
    updatedAt: string;
    failedStage?: string | undefined;
    errorKey?: string | undefined;
}>;
export declare const tenantCreateResultSchema: z.ZodObject<{
    protocolVersion: z.ZodLiteral<"1">;
    tenantId: z.ZodString;
    operationId: z.ZodString;
    status: z.ZodEnum<["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]>;
    stage: z.ZodString;
    failedStage: z.ZodOptional<z.ZodString>;
    errorKey: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    operationId: string;
    status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
    protocolVersion: "1";
    stage: string;
    updatedAt: string;
    failedStage?: string | undefined;
    errorKey?: string | undefined;
}, {
    tenantId: string;
    operationId: string;
    status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
    protocolVersion: "1";
    stage: string;
    updatedAt: string;
    failedStage?: string | undefined;
    errorKey?: string | undefined;
}>;
export type TenantCreateInput = z.infer<typeof tenantCreateInputSchema>;
export type ProvisioningStatusInput = z.infer<typeof provisioningStatusInputSchema>;
export type ProvisioningStatus = z.infer<typeof provisioningStatusSchema>;
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
export interface TenantRpcErrorShape {
    code?: string;
    status: number;
    messageKey: string;
}
export declare class TenantRpcClientError extends Error {
    readonly details: TenantRpcErrorShape;
    constructor(details: TenantRpcErrorShape);
}
export declare function createTenantControlClient(baseUrl: string, fetchImpl?: typeof fetch): {
    create: (input: TenantCreateInput, token: string) => Promise<{
        tenantId: string;
        operationId: string;
        status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
        protocolVersion: "1";
        stage: string;
        updatedAt: string;
        failedStage?: string | undefined;
        errorKey?: string | undefined;
    }>;
    status: (input: ProvisioningStatusInput, token: string) => Promise<{
        tenantId: string;
        operationId: string;
        status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
        protocolVersion: "1";
        stage: string;
        updatedAt: string;
        failedStage?: string | undefined;
        errorKey?: string | undefined;
    }>;
};
//# sourceMappingURL=index.d.ts.map