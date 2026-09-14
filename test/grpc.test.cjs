const test = require("node:test");
const assert = require("node:assert/strict");
const grpc = require("@grpc/grpc-js");
const {
  TENANT_RPC_PROTOCOL_VERSION,
  TenantControlService,
  CreateTenantRequest,
  ProtoProvisioningStatus,
  OperationStatus,
  toTenantRpcServiceError,
  fromGrpcError,
  createTenantControlGrpcClient,
  TenantRpcClientError,
  TENANT_RPC_ERROR_MAPPINGS,
} = require("../dist");

const tenantId = "11111111-1111-4111-8111-111111111111";
const operationId = "22222222-2222-4222-8222-222222222222";

test("proto encode/decode round-trip of CreateTenantRequest and ProvisioningStatus", () => {
  // CreateTenantRequest
  const origReq = {
    tenantId,
    operationId,
    idempotencyKey: "idem-key-123",
    payload: {
      slug: "acme-corp",
      nameEn: "Acme Corp",
      nameAr: "شركة أكمي",
      email: "admin@acme.com",
      phoneNumber: "+1234567890",
      moduleIds: ["33333333-3333-4333-8333-333333333333"],
    },
  };

  const reqBytes = CreateTenantRequest.encode(origReq).finish();
  const decodedReq = CreateTenantRequest.decode(reqBytes);

  assert.equal(decodedReq.tenantId, origReq.tenantId);
  assert.equal(decodedReq.operationId, origReq.operationId);
  assert.equal(decodedReq.idempotencyKey, origReq.idempotencyKey);
  assert.ok(decodedReq.payload);
  assert.equal(decodedReq.payload.slug, origReq.payload.slug);
  assert.equal(decodedReq.payload.nameEn, origReq.payload.nameEn);
  assert.equal(decodedReq.payload.nameAr, origReq.payload.nameAr);
  assert.equal(decodedReq.payload.email, origReq.payload.email);
  assert.equal(decodedReq.payload.phoneNumber, origReq.payload.phoneNumber);
  assert.deepEqual(decodedReq.payload.moduleIds, origReq.payload.moduleIds);

  // ProvisioningStatus
  const now = new Date("2026-09-14T12:30:00.000Z");
  const origStatus = {
    protocolVersion: TENANT_RPC_PROTOCOL_VERSION,
    tenantId,
    operationId,
    status: OperationStatus.OPERATION_STATUS_RUNNING,
    stage: "PROVISIONING_DB",
    failedStage: undefined,
    errorKey: undefined,
    updatedAt: now,
  };

  const statusBytes = ProtoProvisioningStatus.encode(origStatus).finish();
  const decodedStatus = ProtoProvisioningStatus.decode(statusBytes);

  assert.equal(decodedStatus.protocolVersion, origStatus.protocolVersion);
  assert.equal(decodedStatus.tenantId, origStatus.tenantId);
  assert.equal(decodedStatus.operationId, origStatus.operationId);
  assert.equal(decodedStatus.status, origStatus.status);
  assert.equal(decodedStatus.stage, origStatus.stage);
  assert.equal(decodedStatus.failedStage, undefined);
  assert.equal(decodedStatus.errorKey, undefined);
  assert.ok(decodedStatus.updatedAt instanceof Date);
  assert.equal(decodedStatus.updatedAt.toISOString(), now.toISOString());
});

test("mapping table in both directions", () => {
  // Test every mapped key in TENANT_RPC_ERROR_MAPPINGS
  for (const [key, expected] of Object.entries(TENANT_RPC_ERROR_MAPPINGS)) {
    const svcErr = toTenantRpcServiceError(key);
    assert.equal(svcErr.code, expected.grpcCode);
    assert.equal(svcErr.details, key);
    assert.ok(svcErr.metadata);
    assert.equal(svcErr.metadata.get("x-message-key")[0], key);

    const clientErr = fromGrpcError(svcErr);
    assert.ok(clientErr instanceof TenantRpcClientError);
    assert.equal(clientErr.details.messageKey, key);
    assert.equal(clientErr.details.status, expected.httpStatus);
    assert.equal(clientErr.details.code, expected.grpcName);
  }

  // Unknown key -> INTERNAL, 500, replaced by TENANT_CONTROL_UNAVAILABLE
  const unknownSvcErr = toTenantRpcServiceError("SOME_NONEXISTENT_ERROR_KEY");
  assert.equal(unknownSvcErr.code, grpc.status.INTERNAL);
  assert.equal(unknownSvcErr.details, "TENANT_CONTROL_UNAVAILABLE");
  assert.equal(
    unknownSvcErr.metadata.get("x-message-key")[0],
    "TENANT_CONTROL_UNAVAILABLE",
  );

  const unknownClientErr = fromGrpcError(unknownSvcErr);
  assert.ok(unknownClientErr instanceof TenantRpcClientError);
  assert.equal(unknownClientErr.details.messageKey, "TENANT_CONTROL_UNAVAILABLE");
  assert.equal(unknownClientErr.details.status, 500);
  assert.equal(unknownClientErr.details.code, "INTERNAL");

  // Fallback: details regex match when metadata is missing
  const fallbackErr = {
    code: grpc.status.ALREADY_EXISTS,
    details: "TENANT_ALREADY_EXISTS",
  };
  const fromFallback = fromGrpcError(fallbackErr);
  assert.equal(fromFallback.details.messageKey, "TENANT_ALREADY_EXISTS");
  assert.equal(fromFallback.details.status, 409);
  assert.equal(fromFallback.details.code, "ALREADY_EXISTS");

  // Infrastructure codes: UNAVAILABLE, DEADLINE_EXCEEDED, CANCELLED, UNKNOWN -> 503, TENANT_CONTROL_UNAVAILABLE
  for (const infraCode of [
    grpc.status.UNAVAILABLE,
    grpc.status.DEADLINE_EXCEEDED,
    grpc.status.CANCELLED,
    grpc.status.UNKNOWN,
  ]) {
    const infraErr = { code: infraCode, details: "infrastructure error" };
    const res = fromGrpcError(infraErr);
    assert.equal(res.details.status, 503);
    assert.equal(res.details.messageKey, "TENANT_CONTROL_UNAVAILABLE");
    assert.equal(res.details.code, grpc.status[infraCode]);
  }
});

test("createTenantControlGrpcClient against real in-test grpc Server", async (t) => {
  let serverAuthTokenCreate = "";
  let serverAuthTokenStatus = "";
  let serverCallCount = 0;
  let mode = "normal";

  const server = new grpc.Server();
  server.addService(TenantControlService, {
    createTenant: (call, callback) => {
      serverCallCount++;
      const authHeader = call.metadata.get("authorization");
      serverAuthTokenCreate = authHeader.length > 0 ? String(authHeader[0]) : "";

      if (mode === "error-already-exists") {
        callback(toTenantRpcServiceError("TENANT_ALREADY_EXISTS"), null);
        return;
      }
      if (mode === "hang") {
        // Never call callback to trigger deadline exceeded
        return;
      }

      callback(null, {
        protocolVersion: TENANT_RPC_PROTOCOL_VERSION,
        tenantId: call.request.tenantId,
        operationId: call.request.operationId,
        status: OperationStatus.OPERATION_STATUS_QUEUED,
        stage: "QUEUED",
        updatedAt: new Date("2026-09-14T15:00:00.000Z"),
      });
    },
    getProvisioningStatus: (call, callback) => {
      serverCallCount++;
      const authHeader = call.metadata.get("authorization");
      serverAuthTokenStatus = authHeader.length > 0 ? String(authHeader[0]) : "";

      callback(null, {
        protocolVersion: TENANT_RPC_PROTOCOL_VERSION,
        tenantId: call.request.tenantId,
        operationId: call.request.operationId,
        status: OperationStatus.OPERATION_STATUS_SUCCEEDED,
        stage: "COMPLETED",
        updatedAt: new Date("2026-09-14T15:05:00.000Z"),
      });
    },
  });

  const boundPort = await new Promise((resolve, reject) => {
    server.bindAsync(
      "127.0.0.1:0",
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) reject(err);
        else resolve(port);
      },
    );
  });

  t.after(() => {
    server.forceShutdown();
  });

  const address = `127.0.0.1:${boundPort}`;
  const client = createTenantControlGrpcClient(address);

  t.after(() => {
    client.close();
  });

  // 1. Success for create and status
  const createInput = {
    tenantId,
    operationId,
    idempotencyKey: "key-1",
    payload: {
      slug: "test-co",
      nameEn: "Test Co",
      nameAr: "شركة اختبار",
      moduleIds: [],
    },
  };

  const createRes = await client.create(createInput, "token-abc-123");
  assert.equal(serverAuthTokenCreate, "Bearer token-abc-123");
  assert.equal(createRes.status, "QUEUED");
  assert.equal(createRes.updatedAt, "2026-09-14T15:00:00.000Z");
  assert.equal(createRes.stage, "QUEUED");
  assert.equal(createRes.protocolVersion, "1");
  assert.equal(createRes.tenantId, tenantId);
  assert.equal(createRes.operationId, operationId);
  assert.equal("failedStage" in createRes, false);
  assert.equal("errorKey" in createRes, false);

  const statusInput = { tenantId, operationId };
  const statusRes = await client.status(statusInput, "token-xyz-456");
  assert.equal(serverAuthTokenStatus, "Bearer token-xyz-456");
  assert.equal(statusRes.status, "SUCCEEDED");
  assert.equal(statusRes.updatedAt, "2026-09-14T15:05:00.000Z");
  assert.equal(statusRes.stage, "COMPLETED");

  // 2. Server error with ALREADY_EXISTS -> TenantRpcClientError status 409 + messageKey
  mode = "error-already-exists";
  await assert.rejects(
    async () => {
      await client.create(createInput, "token-fail");
    },
    (err) => {
      assert.ok(err instanceof TenantRpcClientError);
      assert.equal(err.details.status, 409);
      assert.equal(err.details.code, "ALREADY_EXISTS");
      assert.equal(err.details.messageKey, "TENANT_ALREADY_EXISTS");
      return true;
    },
  );

  // 3. Invalid input -> 400 without calling the server
  const callsBefore = serverCallCount;
  await assert.rejects(
    async () => {
      await client.create({ tenantId: "not-a-uuid" }, "token");
    },
    (err) => {
      assert.ok(err instanceof TenantRpcClientError);
      assert.equal(err.details.status, 400);
      assert.equal(err.details.code, "INVALID_ARGUMENT");
      assert.equal(err.details.messageKey, "INVALID_TENANT_RPC_INPUT");
      return true;
    },
  );
  assert.equal(serverCallCount, callsBefore);

  await assert.rejects(
    async () => {
      await client.status({ tenantId: "not-a-uuid" }, "token");
    },
    (err) => {
      assert.ok(err instanceof TenantRpcClientError);
      assert.equal(err.details.status, 400);
      assert.equal(err.details.code, "INVALID_ARGUMENT");
      assert.equal(err.details.messageKey, "INVALID_TENANT_RPC_INPUT");
      return true;
    },
  );
  assert.equal(serverCallCount, callsBefore);

  // 4. Server not listening -> 503 TENANT_CONTROL_UNAVAILABLE
  const deadServer = new grpc.Server();
  const deadPort = await new Promise((resolve, reject) => {
    deadServer.bindAsync(
      "127.0.0.1:0",
      grpc.ServerCredentials.createInsecure(),
      (err, port) => (err ? reject(err) : resolve(port)),
    );
  });
  deadServer.forceShutdown();
  const deadPortClient = createTenantControlGrpcClient(`127.0.0.1:${deadPort}`, {
    deadlineMs: 500,
  });
  t.after(() => {
    deadPortClient.close();
  });
  await assert.rejects(
    async () => {
      await deadPortClient.create(createInput, "token");
    },
    (err) => {
      assert.ok(err instanceof TenantRpcClientError);
      assert.equal(err.details.status, 503);
      assert.equal(err.details.messageKey, "TENANT_CONTROL_UNAVAILABLE");
      return true;
    },
  );

  // 5. Deadline exceeded (server that never responds, deadlineMs small) -> 503
  mode = "hang";
  const fastDeadlineClient = createTenantControlGrpcClient(address, {
    deadlineMs: 50,
  });
  t.after(() => {
    fastDeadlineClient.close();
  });
  await assert.rejects(
    async () => {
      await fastDeadlineClient.create(createInput, "token");
    },
    (err) => {
      assert.ok(err instanceof TenantRpcClientError);
      assert.equal(err.details.status, 503);
      assert.equal(err.details.code, "DEADLINE_EXCEEDED");
      assert.equal(err.details.messageKey, "TENANT_CONTROL_UNAVAILABLE");
      return true;
    },
  );
});
