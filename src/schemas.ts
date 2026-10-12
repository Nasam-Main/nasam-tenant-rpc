import { z } from "zod";

export const TENANT_RPC_PROTOCOL_VERSION = "1" as const;

const uuid = z.string().uuid();

const optionalBrandingText = (schema: z.ZodType<string>) => z.preprocess(
  (value) => typeof value === "string" ? value.trim() || undefined : value,
  schema.optional(),
);
const tenantBrandingFieldsSchema = z.object({
  logoUrl: optionalBrandingText(z.string().max(2048).url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  })).transform((value): string | undefined => value),
  primaryColor: optionalBrandingText(z.string().regex(/^#[0-9a-fA-F]{6}$/))
    .transform((value): string | undefined => value?.toUpperCase()),
});
const tenantBrandingSchema = tenantBrandingFieldsSchema.transform((value) =>
  value.logoUrl || value.primaryColor ? value : undefined,
);

export const tenantCreateInputSchema = z.object({
  tenantId: uuid,
  operationId: uuid,
  idempotencyKey: z.string().min(1).max(128),
  payload: z.object({
    slug: z
      .string()
      .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)
      .max(63),
    nameEn: z.string().trim().min(1).max(150),
    nameAr: z.string().trim().min(1).max(150),
    email: z.string().email().max(255).optional(),
    phoneNumber: z.string().min(1).max(20).optional(),
    moduleIds: z.array(uuid).max(32).default([]),
    branding: tenantBrandingSchema.optional(),
  }),
});

export const tenantUpdateInputSchema = z.object({
  tenantId: uuid,
  nameEn: z.string().trim().min(1).max(150),
  nameAr: z.string().trim().min(1).max(150),
  email: z.string().email().max(255).optional(),
  phoneNumber: z.string().min(1).max(20).optional(),
  // An empty object intentionally clears both overrides and restores defaults.
  branding: tenantBrandingFieldsSchema.optional(),
});

export const tenantRecordSchema = z.object({
  id: uuid,
  slug: z.string(),
  nameEn: z.string(),
  nameAr: z.string(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  branding: tenantBrandingFieldsSchema.optional(),
});

export const provisioningStatusInputSchema = z.object({
  tenantId: uuid,
  operationId: uuid,
});

export const tenantGetInputSchema = z.object({
  tenantId: uuid,
});

export const tenantListInputSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const tenantListResultSchema = z.object({
  data: z.array(
    z.object({
      id: uuid,
      slug: z.string(),
      nameEn: z.string(),
      nameAr: z.string(),
      email: z.string().optional(),
      phoneNumber: z.string().optional(),
      status: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  meta: z.object({
    page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number(),
  }),
});

export const moduleListResultSchema = z.object({
  data: z.array(z.object({
    id: uuid,
    slug: z.string(),
    nameEn: z.string(),
    nameAr: z.string(),
    descriptionEn: z.string(),
    descriptionAr: z.string(),
    purchasingPrice: z.number(),
    sellingPrice: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
});

export const subscriptionListInputSchema = z.object({
  page: z.number().int().positive().default(1), limit: z.number().int().positive().max(100).default(20),
  status: z.string().optional(), search: z.string().trim().max(150).optional(),
});
export const subscriptionRecordSchema = z.object({
  id: uuid, organizationId: uuid, organizationNameEn: z.string(), organizationNameAr: z.string(),
  modules: z.array(z.object({ id: uuid, moduleId: uuid, nameEn: z.string(), nameAr: z.string(), descriptionEn: z.string(), descriptionAr: z.string(), price: z.string(), startDate: z.string().nullable(), endDate: z.string().nullable(), status: z.string() })),
  totalPrice: z.string(), currency: z.string(), status: z.string(), createdAt: z.string(),
});
export const subscriptionListResultSchema = z.object({
  data: z.array(subscriptionRecordSchema),
  meta: z.object({ currentPage: z.number(), totalPages: z.number(), totalCount: z.number() }),
});
const isoDateTime = z.string().datetime({ offset: true });
export const subscriptionCreateInputSchema = z.object({
  tenantId: uuid,
  modules: z.array(z.object({
    moduleId: uuid,
    price: z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/),
    startDate: isoDateTime.optional(),
    endDate: isoDateTime.optional(),
  }).refine(
    // A term is both dates with the end after the start, or neither.
    (line) => (line.startDate === undefined) === (line.endDate === undefined)
      && (line.startDate === undefined || Date.parse(line.endDate!) > Date.parse(line.startDate)),
  )).min(1).max(50),
});

const accountAdminStatus = z.enum(["ACTIVE", "INACTIVE", "PENDING_ACTIVATION"]);
const adminName = z.string().trim().min(1).max(100);
const adminEmail = z.string().trim().toLowerCase().email().max(255);
// E.164, the form tenant users store phone numbers in.
const adminPhoneNumber = z.string().trim().regex(/^\+[1-9][0-9]{6,14}$/);

export const accountAdminListInputSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  search: z.string().trim().max(150).optional(),
  status: accountAdminStatus.optional(),
  tenantId: uuid.optional(),
  archived: z.boolean().optional(),
});
export const accountAdminGetInputSchema = z.object({
  tenantId: uuid,
  adminId: uuid,
});
export const accountAdminCreateInputSchema = z.object({
  tenantId: uuid,
  username: z.string().trim().regex(/^[A-Za-z0-9._-]{3,30}$/),
  email: adminEmail,
  phoneNumber: adminPhoneNumber,
  nameEn: adminName,
  nameAr: adminName,
});
export const accountAdminUpdateInputSchema = z.object({
  tenantId: uuid,
  adminId: uuid,
  nameEn: adminName,
  nameAr: adminName,
  email: adminEmail,
  phoneNumber: adminPhoneNumber,
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
export const accountAdminRecordSchema = z.object({
  id: uuid,
  tenantId: uuid,
  tenantNameEn: z.string(),
  tenantNameAr: z.string(),
  username: z.string(),
  email: z.string(),
  phoneNumber: z.string().optional(),
  nameEn: z.string(),
  nameAr: z.string(),
  status: accountAdminStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().optional(),
});
export const accountAdminListResultSchema = z.object({
  data: z.array(accountAdminRecordSchema),
  meta: z.object({
    page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number(),
  }),
});

export const provisioningStatusSchema = z.object({
  protocolVersion: z.literal(TENANT_RPC_PROTOCOL_VERSION),
  tenantId: uuid,
  operationId: uuid,
  status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]),
  stage: z.string(),
  failedStage: z.string().optional(),
  errorKey: z.string().optional(),
  updatedAt: z.string(),
});

export const tenantCreateResultSchema = provisioningStatusSchema;
export type TenantCreateInput = z.infer<typeof tenantCreateInputSchema>;
export type TenantUpdateInput = z.infer<typeof tenantUpdateInputSchema>;
export type TenantRecordResult = z.infer<typeof tenantRecordSchema>;
export type ProvisioningStatusInput = z.infer<
  typeof provisioningStatusInputSchema
>;
export type ProvisioningStatus = z.infer<typeof provisioningStatusSchema>;
export type AccountAdminListInput = z.infer<typeof accountAdminListInputSchema>;
export type AccountAdminGetInput = z.infer<typeof accountAdminGetInputSchema>;
export type AccountAdminCreateInput = z.infer<typeof accountAdminCreateInputSchema>;
export type AccountAdminUpdateInput = z.infer<typeof accountAdminUpdateInputSchema>;
export type AccountAdminRecordResult = z.infer<typeof accountAdminRecordSchema>;
export type AccountAdminListResult = z.infer<typeof accountAdminListResultSchema>;
export type TenantGetInput = z.infer<typeof tenantGetInputSchema>;
export type TenantListInput = z.infer<typeof tenantListInputSchema>;
export type TenantListResult = z.infer<typeof tenantListResultSchema>;
export type ModuleListResult = z.infer<typeof moduleListResultSchema>;
export type SubscriptionListInput = z.infer<typeof subscriptionListInputSchema>;
export type SubscriptionListResult = z.infer<typeof subscriptionListResultSchema>;
export type SubscriptionRecordResult = z.infer<typeof subscriptionRecordSchema>;
export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateInputSchema>;
