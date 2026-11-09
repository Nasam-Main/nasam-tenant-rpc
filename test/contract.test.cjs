const test = require("node:test");
const assert = require("node:assert/strict");
const {
  TENANT_RPC_PROTOCOL_VERSION,
  provisioningStatusSchema,
  tenantCreateInputSchema,
  subscriptionCreateInputSchema,
  subscriptionExtendLineInputSchema,
  moduleUpdatePriceTiersInputSchema,
  priceTierGaps,
} = require("../dist");

const tenantId = "11111111-1111-4111-8111-111111111111";
const operationId = "22222222-2222-4222-8222-222222222222";

test("validates a tenant creation command", () => {
  const value = tenantCreateInputSchema.parse({
    tenantId,
    operationId,
    idempotencyKey: "create-1",
    payload: {
      slug: "acme",
      nameEn: "Acme",
      nameAr: "اكمي",
      moduleIds: [],
    },
  });
  assert.equal(value.tenantId, tenantId);
});

test("rejects caller-selected schema names", () => {
  const result = tenantCreateInputSchema.safeParse({
    tenantId,
    operationId,
    idempotencyKey: "create-1",
    schemaName: "arbitrary",
    payload: {
      slug: "acme",
      nameEn: "Acme",
      nameAr: "اكمي",
      moduleIds: [],
    },
  });
  assert.equal(result.success, true);
  assert.equal("schemaName" in result.data, false);
});

test("validates provisioning status protocol version", () => {
  assert.throws(() =>
    provisioningStatusSchema.parse({
      protocolVersion: `${TENANT_RPC_PROTOCOL_VERSION}-wrong`,
      tenantId,
      operationId,
      status: "QUEUED",
      stage: "QUEUED",
      updatedAt: new Date().toISOString(),
    }),
  );
});

const withBranding = (branding) => ({ tenantId, operationId, idempotencyKey: "brand-1", payload: {
  slug: "acme", nameEn: "Acme", nameAr: "اكمي", moduleIds: [], branding,
}});
test("branding supports omissions and partial overrides and rejects invalid values", () => {
  for (const branding of [undefined, {}, { logoUrl: " ", primaryColor: " " }]) {
    assert.equal(tenantCreateInputSchema.parse(withBranding(branding)).payload.branding, undefined);
  }
  assert.deepEqual(tenantCreateInputSchema.parse(withBranding({ primaryColor: " #aabbcc " })).payload.branding,
    { primaryColor: "#AABBCC" });
  for (const branding of [{ logoUrl: "http://example.com/logo.png" }, { logoUrl: "https://user:pass@example.com/logo.png" },
    { primaryColor: "red" }, { primaryColor: "#abc" }, { logoUrl: "javascript:alert(1)" }]) {
    assert.equal(tenantCreateInputSchema.safeParse(withBranding(branding)).success, false);
  }
});

test("tenant updates preserve branding presence so an empty object can clear overrides", () => {
  const { tenantUpdateInputSchema } = require("../dist");
  const base = { tenantId, nameEn: "Acme", nameAr: "اكمي" };
  assert.equal(tenantUpdateInputSchema.parse(base).branding, undefined);
  assert.deepEqual(tenantUpdateInputSchema.parse({ ...base, branding: {} }).branding, {});
  assert.deepEqual(
    tenantUpdateInputSchema.parse({ ...base, branding: { primaryColor: " #aabbcc " } }).branding,
    { primaryColor: "#AABBCC" },
  );
});

test("a capacity line needs a quantity, a price, a start and a duration", () => {
  const moduleId = "66666666-6666-4666-8666-666666666666";
  const term = { quantity: 100, totalPrice: "12600.00", startDate: "2026-01-01T00:00:00.000Z", durationMonths: 12 };
  const parse = (input) => subscriptionCreateInputSchema.safeParse({ tenantId, ...input }).success;
  assert.equal(parse({ modules: [{ moduleId, ...term }] }), true);
  assert.equal(parse({ devices: term }), true);
  assert.equal(parse({ modules: [{ moduleId, ...term }], devices: term }), true);
  assert.equal(parse({ modules: [] }), false);
  assert.equal(parse({ modules: [{ moduleId, ...term, quantity: 0 }] }), false);
  assert.equal(parse({ modules: [{ moduleId, ...term, quantity: 99_999 }] }), true);
  assert.equal(parse({ modules: [{ moduleId, ...term, quantity: 100_000 }] }), false);
  assert.equal(parse({ modules: [{ moduleId, ...term, totalPrice: "-1" }] }), false);
  assert.equal(parse({ modules: [{ moduleId, ...term, durationMonths: 0 }] }), false);
  const { startDate, ...undated } = term;
  assert.equal(parse({ devices: undated }), false);
});

test("an extension names the line and carries the same figures as a sale", () => {
  const lineId = "55555555-5555-4555-8555-555555555555";
  const term = { quantity: 100, totalPrice: "12600.00", startDate: "2027-01-01T00:00:00.000Z", durationMonths: 12 };
  const parse = (input) => subscriptionExtendLineInputSchema.safeParse({ tenantId, lineId, type: "MODULE", ...term, ...input }).success;
  assert.equal(parse({}), true);
  assert.equal(parse({ type: "DEVICES" }), true);
  assert.equal(parse({ type: undefined }), false);
  assert.equal(parse({ lineId: "not-a-uuid" }), false);
  assert.equal(parse({ quantity: 0 }), false);
  assert.equal(parse({ durationMonths: 0 }), false);
  assert.equal(parse({ startDate: undefined }), false);
});

test("pricing ranges may not overlap, run backwards or leave an open range before the last", () => {
  const moduleId = "66666666-6666-4666-8666-666666666666";
  const error = (priceTiers) => {
    const result = moduleUpdatePriceTiersInputSchema.safeParse({ moduleId, priceTiers });
    return result.success ? null : result.error.issues[0].message;
  };
  assert.equal(error([
    { fromQuantity: 1, toQuantity: 100, monthlyUnitPrice: "200.00" },
    { fromQuantity: 101, monthlyUnitPrice: "180.00" },
  ]), null);
  assert.equal(error([{ fromQuantity: 10, toQuantity: 5, monthlyUnitPrice: "1" }]), "PRICE_TIER_FROM_AFTER_TO");
  assert.equal(error([
    { fromQuantity: 1, toQuantity: 100, monthlyUnitPrice: "1" },
    { fromQuantity: 100, toQuantity: 200, monthlyUnitPrice: "1" },
  ]), "PRICE_TIERS_OVERLAP");
  assert.equal(error([
    { fromQuantity: 1, monthlyUnitPrice: "1" },
    { fromQuantity: 101, toQuantity: 200, monthlyUnitPrice: "1" },
  ]), "PRICE_TIER_OPEN_NOT_LAST");
  assert.notEqual(error([{ fromQuantity: 0, monthlyUnitPrice: "1" }]), null);
  assert.notEqual(error([{ fromQuantity: 1, monthlyUnitPrice: "1.234" }]), null);
});

test("gaps between ranges are reported, not refused", () => {
  assert.deepEqual(priceTierGaps([
    { fromQuantity: 1, toQuantity: 100, monthlyUnitPrice: "1" },
    { fromQuantity: 151, monthlyUnitPrice: "1" },
  ]), [{ fromQuantity: 101, toQuantity: 150 }]);
  assert.deepEqual(priceTierGaps([{ fromQuantity: 1, monthlyUnitPrice: "1" }]), []);
});
