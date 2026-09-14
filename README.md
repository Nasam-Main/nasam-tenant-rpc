# @nasam/tenant-rpc

Versioned runtime schemas, TypeScript types, delegation claims, and the HTTP
client for the private NASAM tenant-control API.

## Install

Pin an immutable Git tag:

```bash
pnpm add "@nasam/tenant-rpc@github:Nasam-Main/nasam-tenant-rpc#v0.1.1"
```

## Release

Update the version, run `npm test`, then create and push the matching
`v<version>` tag. Git installations run the package's `prepare` script, so
`dist` is generated for consumers but is never committed.

This repository is public for dependency distribution. It must never contain
credentials, infrastructure details, customer data, or server implementation.
