# AGENTS.md

AI agent reference for the Gitpod repository.

## Project Overview

Cloud development environment platform. Multi-service architecture using Go, TypeScript, and Java. Build system: [Leeway](https://github.com/gitpod-io/leeway).

## Directory Structure

| Directory | Description |
|-----------|-------------|
| `components/` | All services and libraries (40+ components) |
| `components/server/` | Main backend API server (TypeScript) |
| `components/dashboard/` | Web UI (React/TypeScript) |
| `components/ws-*` | Workspace management services (Go) |
| `components/ide/` | IDE integrations (VS Code, JetBrains) |
| `components/gitpod-protocol/` | Shared protocol definitions |
| `components/gitpod-db/` | Database layer (TypeScript) |
| `components/public-api/` | Public API definitions (protobuf) |
| `install/installer/` | Kubernetes installer (Go) |
| `dev/preview/` | Preview environment tooling |
| `test/` | Integration tests (Go) |

## Setup

Environment setup runs automatically via devcontainer. Manual commands:

```bash
# TypeScript dependencies and build
yarn --network-timeout 100000 && yarn build

# Go module verification
leeway exec --filter-type go -v -- go mod verify

# Java/Gradle build (JetBrains plugins)
leeway exec --package components/supervisor-api/java:lib --package components/gitpod-protocol/java:lib -- ./gradlew build

# Install pre-commit hooks
pre-commit install --install-hooks

# Installer dependencies
cd install/installer && make deps
```

## Build Commands

```bash
# Build all TypeScript packages
yarn build

# Build specific component
leeway build components/server:app
leeway build components/dashboard:app

# Build Docker images
leeway build components/server:docker

# Build all components
leeway build components:all

# Watch mode for TypeScript
yarn watch
```

## Test Commands

### TypeScript (Server)

```bash
cd components/server

# All tests
yarn test

# Unit tests only
yarn test:unit

# DB tests (requires services)
yarn test:db

# Run specific test file
yarn test:unit --grep "pattern"
```

### TypeScript (Dashboard)

```bash
cd components/dashboard

# Unit tests
yarn test:unit

# Watch mode
yarn test:unit:watch
```

### Go

```bash
# Run tests for a package
go test ./...

# Run specific test
go test -v -run TestName ./path/to/package
```

### Integration Tests

```bash
cd test

# Run all integration tests
./run.sh

# Run specific suite
./run.sh -s webapp
./run.sh -s workspace
./run.sh -s ide

# Run single test with go test
go test -v ./... -run TestWorkspaceInstrumentation -namespace=default
```

## Lint/Format

Run before committing:

```bash
# Pre-commit hooks (runs automatically on commit)
pre-commit run --all-files

# Individual checks:
# Go
go fmt ./...
go mod tidy -compat=1.22

# TypeScript (server, dashboard, etc.)
cd components/server && yarn lint
cd components/dashboard && yarn lint

# Prettier (WebApp components)
prettier --write 'components/{server,gitpod-protocol,gitpod-db,dashboard,ws-manager-bridge}/**/*.ts'

# License headers
leeway run components:update-license-header

# Terraform
terraform fmt
```

## PR Requirements

### Branch Naming

No enforced convention. Feature branches typically use descriptive names.

### Commit Format

Include co-author for AI-assisted commits:
```
Co-authored-by: Ona <no-reply@ona.com>
```

### PR Template Checklist

- Description of changes
- Related issue(s): `Fixes #<issue>`
- How to test
- Documentation updates (link to docs issue if needed)

### Required CI Checks

- Build workflow (`build.yml`)
- Pre-commit hooks pass
- Tests pass for affected components

### Build Options (PR comments)

```
- [ ] leeway-no-cache
- [ ] /werft no-test
- [ ] /werft with-preview
- [ ] with-integration-tests=all|workspace|webapp|ide
```

## Key Files

| File | Purpose |
|------|---------|
| `WORKSPACE.yaml` | Leeway workspace config, default build args |
| `components/BUILD.yaml` | Component build definitions |
| `.pre-commit-config.yaml` | Pre-commit hook configuration |
| `.github/workflows/build.yml` | Main CI workflow |
| `memory-bank/` | Project documentation for AI context |

## Common Tasks

### Add new dependency

```bash
# TypeScript (from component directory)
yarn add <package>

# Go
go get <package>
go mod tidy -compat=1.22
```

### Generate protobuf code

```bash
# Go components
cd components/<api-component>
./generate.sh

# TypeScript
cd components/<api-component>/typescript-grpc
yarn install && ./build.sh
```

### Update Go modules

```bash
leeway run components:update-go-modules
```

### Preview Environment

```bash
# Install previewctl
leeway run dev/preview/previewctl:install

# Configure workspace for preview
INSTALL_CONTEXT=true leeway run dev/preview:configure-workspace
```
