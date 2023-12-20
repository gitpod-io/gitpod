## Overview

The ws-manager-api component hosts the api component of ws-manager-mk2.

## Making changes to the api

First, make sure those changes are really neccesary. We want to keep the interface as trim as possible.

There are two types of changes, changes to:

1. proto files, like `core.proto`
2. API clients (we have go and typescript clients)

### Changing the proto file

Say you change `core.proto`. Please run `./generate.sh` in this directory to re-generate the GO and TypeScript protocol implementations.

### Changing API clients

Say you plan to remove a field from a struct in our go client. After doing, then run:

1. `make manifests` from `ws-manager-mk2`, and preserve the copyright headers, to update YAML specifications
2. `make generate` from `ws-manager-mk2`, and preserve the copyright headers, to generate code
