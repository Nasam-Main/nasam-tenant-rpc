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
      branding: { logoUrl: "https://example.com/logo.png", primaryColor: "#112233" },
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
  assert.deepEqual(decodedReq.payload.branding, origReq.payload.branding);

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
  let serverAuthTokenUpdate = "";
  let serverAuthTokenGet = "";
  const receivedAdminRequests = [];
  const receivedSubscriptionRequests = [];
  const adminId = "33333333-3333-4333-8333-333333333333";
  const adminRecord = {
    id: adminId,
    tenantId,
    tenantNameEn: "Saudi Tracking",
    tenantNameAr: "التتبع السعودي",
    username: "st_admin",
    email: "admin@saudi-tracking.sa",
    phoneNumber: "+966500000000",
    nameEn: "Saudi Tracking Admin",
    nameAr: "مسؤول التتبع السعودي",
    status: "PENDING_ACTIVATION",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-02T00:00:00.000Z"),
  };
  let serverCallCount = 0;
  let receivedBranding;
  let mode = "normal";

  const server = new grpc.Server();
  server.addService(TenantControlService, {
    createTenant: (call, callback) => {
      serverCallCount++;
      const authHeader = call.metadata.get("authorization");
      receivedBranding = call.request.payload.branding;
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
    updateTenant: (call, callback) => {
      serverAuthTokenUpdate = String(call.metadata.get("authorization")[0] ?? "");
      callback(null, {
        id: call.request.tenantId,
        slug: "test-co",
        nameEn: call.request.nameEn,
        nameAr: call.request.nameAr,
        email: call.request.email,
        phoneNumber: call.request.phoneNumber,
        status: "ACTIVE",
        createdAt: new Date("2026-09-14T15:00:00.000Z"),
        updatedAt: new Date("2026-09-17T10:00:00.000Z"),
        logoUrl: call.request.branding?.logoUrl,
        primaryColor: call.request.branding?.primaryColor,
      });
    },
    listAccountAdmins: (call, callback) => {
      receivedAdminRequests.push(["list", call.request]);
      callback(null, { admins: [adminRecord], page: 1, limit: 20, total: 1, totalPages: 1 });
    },
    getAccountAdmin: (call, callback) => {
      receivedAdminRequests.push(["get", call.request]);
      callback(null, adminRecord);
    },
    createAccountAdmin: (call, callback) => {
      receivedAdminRequests.push(["create", call.request]);
      callback(toTenantRpcServiceError("TENANT_ALREADY_HAS_ADMIN"), null);
    },
    createSubscription: (call, callback) => {
      receivedSubscriptionRequests.push(call.request);
      const [line] = call.request.modules;
      callback(null, {
        id: "44444444-4444-4444-8444-444444444444",
        organizationId: call.request.tenantId,
        organizationNameEn: "Saudi Tracking",
        organizationNameAr: "التتبع السعودي",
        modules: [{
          id: "55555555-5555-4555-8555-555555555555", moduleId: line.moduleId,
          nameEn: "Fleet", nameAr: "الأسطول", descriptionEn: "", descriptionAr: "",
          price: line.price, startDate: line.startDate, endDate: line.endDate, status: "ACTIVE",
        }],
        totalPrice: line.price, currency: "SAR", status: "ACTIVE",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
      });
    },
    updateAccountAdmin: (call, callback) => {
      receivedAdminRequests.push(["update", call.request]);
      callback(null, { ...adminRecord, status: call.request.status ?? adminRecord.status });
    },
    archiveTenant: (call, callback) => {
      receivedAdminRequests.push(["archiveTenant", call.request]);
      callback(null, {
        id: call.request.tenantId, slug: "saudi-tracking", nameEn: "Saudi Tracking", nameAr: "التتبع السعودي",
        status: "ARCHIVED", createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-03T00:00:00.000Z"),
      });
    },
    restoreTenant: (call, callback) => {
      callback(toTenantRpcServiceError("TENANT_NOT_ARCHIVED"), null);
    },
    deleteAccountAdmin: (call, callback) => {
      receivedAdminRequests.push(["delete", call.request]);
      callback(null, { ...adminRecord, archivedAt: new Date("2026-09-05T00:00:00.000Z") });
    },
    restoreAccountAdmin: (call, callback) => {
      receivedAdminRequests.push(["restore", call.request]);
      callback(null, { ...adminRecord, status: "ACTIVE" });
    },
    updateModulePrice: (call, callback) => {
      receivedAdminRequests.push(["updateModulePrice", call.request]);
      callback(null, {
        id: call.request.moduleId, slug: "FLEET", nameEn: "Fleet", nameAr: "الأسطول",
        descriptionEn: "", descriptionAr: "",
        purchasingPrice: call.request.sellingPrice, sellingPrice: call.request.sellingPrice,
        createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-06T00:00:00.000Z"),
      });
    },
    getTenant: (call, callback) => {
      serverAuthTokenGet = String(call.metadata.get("authorization")[0] ?? "");
      if (call.request.tenantId !== tenantId) {
        callback(toTenantRpcServiceError("TENANT_NOT_FOUND"), null);
        return;
      }
      callback(null, {
        id: call.request.tenantId,
        slug: "saudi-tracking",
        nameEn: "Saudi Tracking",
        nameAr: "التتبع السعودي",
        status: "ACTIVE",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-02T00:00:00.000Z"),
        logoUrl: "https://files.example.com/logo.png",
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
      branding: { primaryColor: "#aabbcc" },
      slug: "test-co",
      nameEn: "Test Co",
      nameAr: "شركة اختبار",
      moduleIds: [],
    },
  };

  const createRes = await client.create(createInput, "token-abc-123");
  assert.equal(serverAuthTokenCreate, "Bearer token-abc-123");
  assert.deepEqual(receivedBranding, { logoUrl: undefined, primaryColor: "#AABBCC" });
  assert.equal(createRes.status, "QUEUED");
  assert.equal(createRes.updatedAt, "2026-09-14T15:00:00.000Z");
  assert.equal(createRes.stage, "QUEUED");
  assert.equal(createRes.protocolVersion, "1");
  assert.equal(createRes.tenantId, tenantId);
  assert.equal(createRes.operationId, operationId);
  assert.equal("failedStage" in createRes, false);
  assert.equal("errorKey" in createRes, false);

  const updated = await client.update({
    tenantId,
    nameEn: "Updated Co",
    nameAr: "شركة محدثة",
    branding: { primaryColor: "#abcdef" },
  }, "token-update");
  assert.equal(serverAuthTokenUpdate, "Bearer token-update");
  assert.equal(updated.nameEn, "Updated Co");
  assert.deepEqual(updated.branding, { primaryColor: "#ABCDEF" });

  const fetched = await client.get({ tenantId }, "token-get");
  assert.equal(serverAuthTokenGet, "Bearer token-get");
  assert.equal(fetched.slug, "saudi-tracking");
  assert.equal(fetched.createdAt, "2026-09-01T00:00:00.000Z");
  assert.deepEqual(fetched.branding, { logoUrl: "https://files.example.com/logo.png" });
  await assert.rejects(
    () => client.get({ tenantId: "99999999-9999-4999-8999-999999999999" }, "token-get"),
    (err) => {
      assert.ok(err instanceof TenantRpcClientError);
      assert.equal(err.details.status, 404);
      assert.equal(err.details.messageKey, "TENANT_NOT_FOUND");
      return true;
    },
  );
  await assert.rejects(() => client.get({ tenantId: "not-a-uuid" }, "token-get"), (err) => {
    assert.equal(err.details.messageKey, "INVALID_TENANT_RPC_INPUT");
    return true;
  });

  const admins = await client.listAccountAdmins({ search: " admin " }, "token-admins");
  assert.equal(admins.meta.total, 1);
  assert.equal(admins.data[0].createdAt, "2026-09-01T00:00:00.000Z");
  assert.equal(receivedAdminRequests[0][1].search, "admin");
  const admin = await client.getAccountAdmin({ tenantId, adminId }, "token-admins");
  assert.equal(admin.tenantNameEn, "Saudi Tracking");
  await assert.rejects(
    () => client.createAccountAdmin({
      tenantId, username: "st_admin2", email: " New@Example.com ",
      phoneNumber: "+966500000001", nameEn: "New", nameAr: "جديد",
    }, "token-admins"),
    (err) => {
      assert.equal(err.details.status, 409);
      assert.equal(err.details.messageKey, "TENANT_ALREADY_HAS_ADMIN");
      return true;
    },
  );
  assert.equal(receivedAdminRequests[2][1].email, "new@example.com");
  const updatedAdmin = await client.updateAccountAdmin({
    tenantId, adminId, nameEn: "A", nameAr: "ب", email: "a@example.com",
    phoneNumber: "+966500000000", status: "INACTIVE",
  }, "token-admins");
  assert.equal(updatedAdmin.status, "INACTIVE");
  await assert.rejects(
    () => client.createAccountAdmin({ tenantId, username: "x", email: "bad", phoneNumber: "1", nameEn: "", nameAr: "" }, "t"),
    (err) => err.details.messageKey === "INVALID_TENANT_RPC_INPUT",
  );

  const moduleId = "66666666-6666-4666-8666-666666666666";
  const subscription = await client.createSubscription({
    tenantId,
    modules: [{ moduleId, price: "1500.00", startDate: "2026-09-30T21:00:00.000Z", endDate: "2027-09-30T21:00:00.000Z" }],
  }, "token-subscriptions");
  assert.ok(receivedSubscriptionRequests[0].modules[0].startDate instanceof Date);
  assert.equal(subscription.organizationId, tenantId);
  assert.equal(subscription.modules[0].price, "1500.00");
  assert.equal(subscription.modules[0].startDate, "2026-09-30T21:00:00.000Z");
  assert.equal(subscription.createdAt, "2026-09-01T00:00:00.000Z");
  await assert.rejects(
    () => client.createSubscription({ tenantId, modules: [{ moduleId, price: "1500.00", startDate: "2026-09-30T21:00:00.000Z" }] }, "t"),
    (err) => err.details.messageKey === "INVALID_TENANT_RPC_INPUT",
  );
  assert.equal(receivedSubscriptionRequests.length, 1);

  const archivedTenant = await client.archive({ tenantId }, "token-archive");
  assert.equal(archivedTenant.status, "ARCHIVED");
  await assert.rejects(() => client.restore({ tenantId }, "token-restore"), (err) => {
    assert.equal(err.details.status, 409);
    assert.equal(err.details.messageKey, "TENANT_NOT_ARCHIVED");
    return true;
  });
  const archivedAdmins = await client.listAccountAdmins({ archived: true }, "token-admins");
  assert.equal(receivedAdminRequests.at(-1)[1].archived, true);
  assert.equal(archivedAdmins.data.length, 1);
  const deletedAdmin = await client.deleteAccountAdmin({ tenantId, adminId }, "token-admins");
  assert.equal(deletedAdmin.archivedAt, "2026-09-05T00:00:00.000Z");
  const restoredAdmin = await client.restoreAccountAdmin({ tenantId, adminId }, "token-admins");
  assert.equal(restoredAdmin.status, "ACTIVE");
  assert.equal(restoredAdmin.archivedAt, undefined);

  const moduleRecord = await client.updateModulePrice(
    { moduleId: "66666666-6666-4666-8666-666666666666", sellingPrice: 1750.5 },
    "token-modules",
  );
  assert.equal(moduleRecord.sellingPrice, 1750.5);
  assert.equal(moduleRecord.updatedAt, "2026-09-06T00:00:00.000Z");
  await assert.rejects(
    () => client.updateModulePrice({ moduleId: "66666666-6666-4666-8666-666666666666", sellingPrice: 1.234 }, "t"),
    (err) => err.details.messageKey === "INVALID_TENANT_RPC_INPUT",
  );
  await assert.rejects(
    () => client.updateModulePrice({ moduleId: "66666666-6666-4666-8666-666666666666", sellingPrice: -1 }, "t"),
    (err) => err.details.messageKey === "INVALID_TENANT_RPC_INPUT",
  );

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
