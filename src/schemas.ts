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

// Decimal(12, 2) money as a string, e.g. "1500.00".
const decimalString = z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/);
const isoDateTime = z.string().datetime({ offset: true });

export const priceTierSchema = z.object({
  fromQuantity: z.number().int().positive(),
  // Omitted on an open-ended last range.
  toQuantity: z.number().int().positive().optional(),
  monthlyUnitPrice: decimalString,
});

/** The first rule a range set breaks, as its message key, or null. Gaps are
 * not refused: the ranges only pre-fill a sale, which may set any price. */
export function priceTiersError(tiers: readonly PriceTierInput[]): string | null {
  const sorted = [...tiers].sort((a, b) => a.fromQuantity - b.fromQuantity);
  for (const [index, tier] of sorted.entries()) {
    if (tier.toQuantity !== undefined && tier.fromQuantity > tier.toQuantity) {
      return "PRICE_TIER_FROM_AFTER_TO";
    }
    if (tier.toQuantity === undefined && index !== sorted.length - 1) {
      return "PRICE_TIER_OPEN_NOT_LAST";
    }
    const previous = sorted[index - 1];
    if (previous?.toQuantity !== undefined && tier.fromQuantity <= previous.toQuantity) {
      return "PRICE_TIERS_OVERLAP";
    }
  }
  return null;
}

/** The quantities a range set leaves unpriced, for the screen to point out. */
export function priceTierGaps(
  tiers: readonly PriceTierInput[],
): Array<{ fromQuantity: number; toQuantity: number }> {
  const sorted = [...tiers].sort((a, b) => a.fromQuantity - b.fromQuantity);
  const gaps: Array<{ fromQuantity: number; toQuantity: number }> = [];
  let next = 1;
  for (const tier of sorted) {
    if (tier.fromQuantity > next) {
      gaps.push({ fromQuantity: next, toQuantity: tier.fromQuantity - 1 });
    }
    if (tier.toQuantity === undefined) return gaps;
    next = Math.max(next, tier.toQuantity + 1);
  }
  return gaps;
}

const priceTiersSchema = z.array(priceTierSchema).max(50)
  .superRefine((tiers, ctx) => {
    const error = priceTiersError(tiers);
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
  });

export const moduleRecordSchema = z.object({
  id: uuid,
  slug: z.string(),
  nameEn: z.string(),
  nameAr: z.string(),
  descriptionEn: z.string(),
  descriptionAr: z.string(),
  priceTiers: z.array(priceTierSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const moduleListInputSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  search: z.string().trim().max(150).optional(),
});
export const moduleListResultSchema = z.object({
  data: z.array(moduleRecordSchema),
  meta: z.object({
    page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number(),
  }),
});
export const moduleGetInputSchema = z.object({ moduleId: uuid });
export const moduleUpdatePriceTiersInputSchema = z.object({
  moduleId: uuid,
  priceTiers: priceTiersSchema,
});

export const devicePricingRecordSchema = z.object({
  priceTiers: z.array(priceTierSchema),
  updatedAt: z.string().optional(),
});
export const devicePricingUpdateInputSchema = z.object({
  priceTiers: priceTiersSchema,
});

export const subscriptionListInputSchema = z.object({
  page: z.number().int().positive().default(1), limit: z.number().int().positive().max(100).default(20),
  status: z.string().optional(), search: z.string().trim().max(150).optional(),
});
export const subscriptionRecordSchema = z.object({
  id: uuid, organizationId: uuid, organizationNameEn: z.string(), organizationNameAr: z.string(),
  modules: z.array(z.object({ id: uuid, moduleId: uuid, nameEn: z.string(), nameAr: z.string(), descriptionEn: z.string(), descriptionAr: z.string(), price: z.string(), quantity: z.number().int().nullable(), startDate: z.string().nullable(), endDate: z.string().nullable(), status: z.string() })),
  devices: z.object({ id: uuid, quantity: z.number().int(), price: z.string(), startDate: z.string(), endDate: z.string(), status: z.string() }).nullable(),
  totalPrice: z.string(), currency: z.string(), status: z.string(), createdAt: z.string(),
});
export const subscriptionListResultSchema = z.object({
  data: z.array(subscriptionRecordSchema),
  meta: z.object({ currentPage: z.number(), totalPages: z.number(), totalCount: z.number() }),
});

// A Level 0 line always has a term: a start and a whole number of months.
const capacityTerm = {
  quantity: z.number().int().positive().max(99_999),
  // What the whole line costs as agreed; the seller may discount it.
  totalPrice: decimalString,
  startDate: isoDateTime,
  durationMonths: z.number().int().positive().max(120),
};
export const subscriptionCreateInputSchema = z.object({
  tenantId: uuid,
  modules: z.array(z.object({ moduleId: uuid, ...capacityTerm })).max(50).default([]),
  devices: z.object(capacityTerm).optional(),
}).refine(
  // Something has to be sold.
  (input) => input.modules.length > 0 || input.devices !== undefined,
);

export const subscriptionLineTypeSchema = z.enum(["MODULE", "DEVICES"]);
export const subscriptionLineDetailsSchema = z.object({
  id: uuid,
  type: subscriptionLineTypeSchema,
  moduleId: uuid.nullable(),
  nameEn: z.string().nullable(),
  nameAr: z.string().nullable(),
  quantity: z.number().int().nullable(),
  unitPrice: z.string().nullable(),
  durationMonths: z.number().int().nullable(),
  totalPrice: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  status: z.string(),
  used: z.number().int().nullable(),
  remaining: z.number().int().nullable(),
  overage: z.number().int().nullable(),
});
export const subscriptionDetailsSchema = z.object({
  id: uuid,
  organizationId: uuid,
  organizationNameEn: z.string(),
  organizationNameAr: z.string(),
  current: z.array(subscriptionLineDetailsSchema),
  history: z.array(subscriptionLineDetailsSchema),
  // Absent from a server older than 0.10.0.
  future: z.array(subscriptionLineDetailsSchema).default([]),
  totalPrice: z.string(),
  currency: z.string(),
});
export const subscriptionGetInputSchema = z.object({ tenantId: uuid });
export const subscriptionLineStatusInputSchema = z.object({
  tenantId: uuid,
  lineId: uuid,
  type: subscriptionLineTypeSchema,
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
// The next term of a current line, with the same figures as a sale.
export const subscriptionExtendLineInputSchema = z.object({
  tenantId: uuid,
  lineId: uuid,
  type: subscriptionLineTypeSchema,
  ...capacityTerm,
});
// A future line's new figures, the same as it was sold with.
export const subscriptionUpdateFutureLineInputSchema = subscriptionExtendLineInputSchema;
// The future line to cancel.
export const subscriptionDeleteFutureLineInputSchema = z.object({
  tenantId: uuid,
  lineId: uuid,
  type: subscriptionLineTypeSchema,
});

export const usageReportInputSchema = z.object({
  tenantId: uuid,
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});
export const usageReportSchema = z.object({
  tenantId: uuid,
  year: z.number().int(),
  month: z.number().int(),
  rows: z.array(z.object({
    type: subscriptionLineTypeSchema,
    moduleId: uuid.nullable(),
    nameEn: z.string().nullable(),
    nameAr: z.string().nullable(),
    paid: z.number().int(),
    actual: z.number().int(),
    remaining: z.number().int(),
    // Null when paid is zero: the share can't be computed.
    usagePercent: z.number().nullable(),
  })),
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
export type PriceTierInput = z.infer<typeof priceTierSchema>;
export type ModuleListInput = z.input<typeof moduleListInputSchema>;
export type ModuleListResult = z.infer<typeof moduleListResultSchema>;
export type ModuleRecordResult = z.infer<typeof moduleRecordSchema>;
export type ModuleGetInput = z.infer<typeof moduleGetInputSchema>;
export type ModuleUpdatePriceTiersInput = z.infer<typeof moduleUpdatePriceTiersInputSchema>;
export type DevicePricingRecordResult = z.infer<typeof devicePricingRecordSchema>;
export type DevicePricingUpdateInput = z.infer<typeof devicePricingUpdateInputSchema>;
export type SubscriptionListInput = z.infer<typeof subscriptionListInputSchema>;
export type SubscriptionListResult = z.infer<typeof subscriptionListResultSchema>;
export type SubscriptionRecordResult = z.infer<typeof subscriptionRecordSchema>;
export type SubscriptionCreateInput = z.input<typeof subscriptionCreateInputSchema>;
export type SubscriptionLineType = z.infer<typeof subscriptionLineTypeSchema>;
export type SubscriptionLineDetailsResult = z.infer<typeof subscriptionLineDetailsSchema>;
export type SubscriptionDetailsResult = z.infer<typeof subscriptionDetailsSchema>;
export type SubscriptionGetInput = z.infer<typeof subscriptionGetInputSchema>;
export type SubscriptionLineStatusInput = z.infer<typeof subscriptionLineStatusInputSchema>;
export type SubscriptionExtendLineInput = z.infer<typeof subscriptionExtendLineInputSchema>;
export type SubscriptionUpdateFutureLineInput = z.infer<typeof subscriptionUpdateFutureLineInputSchema>;
export type SubscriptionDeleteFutureLineInput = z.infer<typeof subscriptionDeleteFutureLineInputSchema>;
export type UsageReportInput = z.infer<typeof usageReportInputSchema>;
export type UsageReportResult = z.infer<typeof usageReportSchema>;
