# @nasam/tenant-rpc

Versioned runtime schemas, TypeScript types, delegation claims, and the HTTP
client for the private NASAM tenant-control API.

## Install

Pin an immutable Git tag:

```bash
pnpm add "@nasam/tenant-rpc@github:Nasam-Main/nasam-tenant-rpc#v0.1.0"
```

## Release

Update the version, run `npm test`, commit the generated `dist`, then create and
push the matching `v<version>` tag. Consumers update deliberately to that tag.

This repository is public for dependency distribution. It must never contain
credentials, infrastructure details, customer data, or server implementation.
