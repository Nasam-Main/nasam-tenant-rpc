const test = require("node:test");
const assert = require("node:assert/strict");
const {
  TENANT_RPC_PROTOCOL_VERSION,
  provisioningStatusSchema,
  tenantCreateInputSchema,
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
