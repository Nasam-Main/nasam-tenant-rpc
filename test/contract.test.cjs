const test = require("node:test");
const assert = require("node:assert/strict");
const {
  TENANT_RPC_PROTOCOL_VERSION,
  provisioningStatusSchema,
  tenantCreateInputSchema,
  subscriptionCreateInputSchema,
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

test("subscription lines take both term dates after one another, or neither", () => {
  const moduleId = "66666666-6666-4666-8666-666666666666";
  const parse = (line) => subscriptionCreateInputSchema.safeParse({ tenantId, modules: [{ moduleId, price: "10.50", ...line }] }).success;
  assert.equal(parse({}), true);
  assert.equal(parse({ startDate: "2026-01-01T00:00:00.000Z", endDate: "2027-01-01T00:00:00.000Z" }), true);
  assert.equal(parse({ startDate: "2026-01-01T00:00:00.000Z" }), false);
  assert.equal(parse({ startDate: "2027-01-01T00:00:00.000Z", endDate: "2026-01-01T00:00:00.000Z" }), false);
  assert.equal(parse({ price: "-1" }), false);
  assert.equal(subscriptionCreateInputSchema.safeParse({ tenantId, modules: [] }).success, false);
});
