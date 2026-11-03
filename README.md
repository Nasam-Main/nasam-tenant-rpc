# @nasam/tenant-rpc

Versioned runtime schemas, TypeScript types, delegation claims, Protobuf contracts, and gRPC / HTTP clients for the private NASAM tenant-control API.

## Install

Pin an immutable Git tag:

```bash
pnpm add "@nasam/tenant-rpc@github:Nasam-Main/nasam-tenant-rpc#v0.2.0"
```

Peer dependencies:
Consumers using the gRPC client must install `@grpc/grpc-js` (`^1.10`).

## Protobuf Contract

The canonical Protocol Buffers definition is located at:
`proto/nasam/tenant_control/v1/tenant_control.proto` (package `nasam.tenant_control.v1`).

The proto definitions are published with the package and available for server implementations and cross-language consumers.

## gRPC Client

The primary transport is gRPC. Use `createTenantControlGrpcClient`:

```typescript
import { createTenantControlGrpcClient } from "@nasam/tenant-rpc";
import * as grpc from "@grpc/grpc-js";

const client = createTenantControlGrpcClient("127.0.0.1:50051", {
  credentials: grpc.credentials.createInsecure(), // optional, defaults to insecure
  deadlineMs: 10000,                              // optional, defaults to 10000 ms
});

// Create tenant
const status = await client.create(
  {
    tenantId: "11111111-1111-4111-8111-111111111111",
    operationId: "22222222-2222-4222-8222-222222222222",
    idempotencyKey: "unique-key",
    payload: {
      slug: "acme",
      nameEn: "Acme",
      nameAr: "أكمي",
      moduleIds: [],
    },
  },
  delegationToken,
);

// Get provisioning status
const currentStatus = await client.status(
  {
    tenantId: "11111111-1111-4111-8111-111111111111",
    operationId: "22222222-2222-4222-8222-222222222222",
  },
  delegationToken,
);

// Close client channel when done
client.close();
```

### Options

- `address`: Server address in `host:port` format.
- `options.credentials`: `@grpc/grpc-js` `ChannelCredentials` instance. Defaults to `grpc.credentials.createInsecure()`.
- `options.deadlineMs`: Per-call timeout in milliseconds. Defaults to `10000` (10 seconds).

## HTTP Client (Deprecated)

`createTenantControlClient` (tRPC over HTTP) is deprecated as of 0.2.0 and will be removed in 1.0.0. New integrations should use `createTenantControlGrpcClient`.

## Release

Update the version, run `npm test`, then create and push the matching
`v<version>` tag. Git installations run the package's `prepare` script, so
`dist` is generated for consumers but is never committed.

This repository is public for dependency distribution. It must never contain
credentials, infrastructure details, customer data, or server implementation.

After tag CI succeeds, the workflow sends a `tenant-rpc-released` repository
dispatch to each configured consumer. `CONSUMER_REPOS_TOKEN` must be a
fine-grained GitHub token with access limited to the consumer repositories and
permission to trigger repository dispatch events. Scheduled consumer checks
remain as a fallback.
