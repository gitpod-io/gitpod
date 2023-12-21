## Overview

The ws-manager-api component hosts the api component of ws-manager-mk2.

## Making changes to the api

There are two types of changes, changes to:

1. proto files, like `core.proto`
2. API clients (we have Go and TypeScript clients)

### Changing the proto file

Say you change `core.proto`. Please run `generate.sh` from `ws-manager-api` to re-generate the Go and TypeScript clients.

### Changing API clients

Say you plan to remove a field from a struct in our Go client. After doing, then run:

1. `make manifests` from `components/ws-manager-mk2`, and preserve the copyright headers, to update YAML specifications
2. `make generate` from `components/ws-manager-mk2`, and preserve the copyright headers, to generate code
