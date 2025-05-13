# Gitpod Components Index

This file serves as index for the per-component documentation in individual md files in the `memory-bank/components` directory.

**Use the index to search for keywords to identify component documentation files to read in depth**

## Core Services

### [server](components/server.md)
- Keywords: Core backend orchestrator; API (HTTP, WebSocket, gRPC); Auth & User/Workspace mgmt; SCM integration
- Used by: Dashboard, IDE, CLI, public-api-server, other backend services
- Uses: gitpod-db, ws-manager-api, content-service-api, image-builder-api, spicedb

### [content-service](components/content-service.md)
- Keywords: Manages workspace content, blobs, logs, IDE plugins; gRPC services; Storage & retrieval; Unified content API
- Used by: ws-manager-mk2, ide-service, supervisor, other Gitpod services
- Uses: common-go, content-service-api, Storage Backends

### [ws-manager-mk2](components/ws-manager-mk2.md)
- Keywords: Kubernetes controller; Workspace lifecycle (CRDs, timeouts, resources); gRPC API; controller-runtime
- Used by: server (via ws-manager-api)
- Uses: K8s API, content-service, registry-facade-api, image-builder-api, ws-daemon-api

### [ws-daemon](components/ws-daemon.md)
- Keywords: Node-level daemon; Workspace init, content sync, backups, resource mgmt (disk quotas, LVM); gRPC API
- Used by: ws-manager-mk2, supervisor
- Uses: content-service, common-go, Storage Backends, K8s API

### [image-builder-mk3](components/image-builder-mk3.md)
- Keywords: Custom workspace image builds (Docker); gRPC API for build lifecycle & logs; Image caching & registry push
- Used by: ws-manager-mk2, server
- Uses: K8s API, Container Registries, content-service, ws-manager-api, registry-facade-api, common-go

## API Components

### [content-service-api](components/content-service-api.md)
- Keywords: gRPC API definitions (protobuf) for Content Service; Workspace content, blobs, logs, plugins; Code generation
- Used by: content-service, ws-manager-mk2, dashboard, ide, server, image-builder-mk3
- Uses: Protocol Buffers, gRPC, buf (tooling)

### [ws-manager-api](components/ws-manager-api.md)
- Keywords: gRPC API definitions (protobuf) for Workspace Manager; Workspace lifecycle, status, control; Code generation
- Used by: ws-manager-mk2 (implements), server, ws-manager-bridge, monitoring/billing/admin tools
- Uses: content-service-api, Protocol Buffers, gRPC, buf/protoc (tooling)

### [ws-daemon-api](components/ws-daemon-api.md)
- Keywords: gRPC API for Workspace Daemon; Workspace content, filesystem, low-level container ops; Code generation
- Used by: ws-daemon (implements), ws-manager-mk2, workspacekit
- Uses: content-service-api, Protocol Buffers, gRPC, buf/protoc (tooling)

### [image-builder-api](components/image-builder-api.md)
- Keywords: gRPC API for Image Builder; Workspace image build/management, subassemblies; Code generation
- Used by: image-builder-mk3 (implements), ws-manager-mk2, server, prebuild systems
- Uses: content-service-api, Protocol Buffers, gRPC, buf/protoc (tooling)

### [supervisor-api](components/supervisor-api.md)
- Keywords: gRPC API for Supervisor (in-workspace); Terminals, port forwarding, tasks, SSH, lifecycle; Code gen (Go, Java, Gateway)
- Used by: supervisor (implements), ide, ws-manager-mk2, local-app, image-builder-mk3
- Uses: content-service-api, Protocol Buffers, gRPC, buf/protoc (tooling)

### [registry-facade-api](components/registry-facade-api.md)
- Keywords: gRPC API for Registry Facade; Composite image specs (base, IDE, content, supervisor); Code gen (Go)
- Used by: registry-facade (implements), ws-manager-mk2, content-service, image-builder-mk3
- Uses: Protocol Buffers, gRPC, buf/protoc (tooling)

### [ide-service-api](components/ide-service-api.md)
- Keywords: gRPC API for IDE Service; IDE config, workspace IDE resolution; Code gen (Go, ts_proto)
- Used by: ide-service (implements), ws-manager-mk2, supervisor, server
- Uses: Protocol Buffers, gRPC, buf/protoc, ts_proto (tooling)

### [ide-metrics-api](components/ide-metrics-api.md)
- Keywords: gRPC API for IDE metrics/errors; Counters, histograms, error reports; Code gen (Go, Java, Gateway)
- Used by: ide-metrics (implements), ide (extensions/plugins), supervisor
- Uses: Protocol Buffers, gRPC, buf/protoc, gRPC Gateway (tooling)

### [ws-manager-bridge-api](components/ws-manager-bridge-api.md)
- Keywords: gRPC API for ws-manager-bridge; Dynamic cluster mgmt (register, update, list); Code gen (Go, TS, buf)
- Used by: ws-manager-bridge (implements), server, cluster/load-balancing/admin/monitoring tools
- Uses: Protocol Buffers, gRPC, buf (tooling)

### [usage-api](components/usage-api.md)
- Keywords: gRPC API for Usage/Billing; Workspace usage, credits, cost centers, Stripe integration; Code gen (Go, TS, buf)
- Used by: usage (implements), server, ws-manager-mk2, admin/reporting tools
- Uses: Protocol Buffers, gRPC, buf, ts_proto (tooling)

### [local-app-api](components/local-app-api.md)
- Keywords: gRPC API for Local App; Port tunneling, SSH connections (local-to-remote); Code gen (Go)
- Used by: local-app (implements), ide (extensions), gitpod-cli, server
- Uses: supervisor-api, Protocol Buffers, gRPC, buf/protoc (tooling)

## Frontend Components

### [dashboard](components/dashboard.md)
- Keywords: Web UI (SPA); Workspace/account mgmt, settings, billing; React, Tailwind, React Query, Stripe; REST/WebSocket/Public API client
- Used by: End-users
- Uses: server, public-api, ide-service-api, content-service-api, ws-manager-api, Stripe JS, gitpod-protocol

### [ide](components/ide.md)
- Keywords: IDE packaging (VS Code, JetBrains); Configuration, plugins, Docker images; Sub-components (Code, JetBrains)
- Used by: supervisor, ide-service, ide-proxy; End-users (interact with)
- Uses: supervisor-api, ide-service-api, blobserve, registry-facade, External IDE sources

## Infrastructure Components

### [proxy](components/proxy.md)
- Keywords: Main ingress (HTTP/WebSocket); Caddy-based; TLS, routing, security; Custom plugins; Workspace routing
- Used by: External clients (browser, IDE, CLI)
- Uses: server, dashboard, ws-proxy, ide-proxy, public-api-server, ConfigCat

### [registry-facade](components/registry-facade.md)
- Keywords: Dynamic image layer injection (supervisor, IDE); Docker Registry API; Layer caching; IPFS option
- Used by: Container runtime, ws-manager-mk2 (via API)
- Uses: registry-facade-api, ws-manager-api, ide-service-api, Upstream Registries, blobserve, common-go, IPFS

### [blobserve](components/blobserve.md)
- Keywords: Serves static assets from OCI images; Layer extraction/caching; HTTP server; Registry auth
- Used by: registry-facade, ws-manager-mk2, ide
- Uses: Container Registries, registry-facade-api, common-go, Prometheus

### [ipfs](components/ipfs.md)
- Keywords: IPFS (Kubo, Cluster); Container layer caching; Distributed storage; Redis for CID mapping
- Used by: registry-facade, content-service (potentially)
- Uses: Redis, External Container Registries, Kubernetes API, External IPFS images

### [openvsx-proxy](components/openvsx-proxy.md)
- Keywords: Caching proxy for OpenVSX; Two-tier cache (Redis/BigCache); Fallback access; Prometheus
- Used by: ide (VS Code/Theia), ide-service, supervisor (potentially)
- Uses: OpenVSX Registry (external), Redis, Prometheus, common-go, Gitpod Experiment Framework

### [scheduler-extender](components/scheduler-extender.md)
- Keywords: K8s scheduler extender; Custom workspace scheduling; Uses external ECR image
- Used by: Kubernetes Scheduler, ws-manager-mk2 (indirectly)
- Uses: AWS ECR (external image), Kubernetes API, node-labeler (data), registry-facade

## Database and Storage

### [gitpod-db](components/gitpod-db.md)
- Keywords: Database layer (TypeORM); Entities (User, Workspace, Team), migrations; Repository pattern; MySQL, Redis
- Used by: server, ws-manager-mk2, (components needing DB persistence)
- Uses: gitpod-protocol, TypeORM, MySQL, Redis, Prometheus

### [gitpod-protocol](components/gitpod-protocol.md)
- Keywords: Core type definitions (TS, Go, Java); Shared data structures & service interfaces; Messaging, encryption
- Used by: server, dashboard, gitpod-db, ws-manager-mk2, ide-service, most components
- Uses: TypeScript, JSON-RPC, WebSocket, Crypto libs (tech)

## Workspace Components

### [supervisor](components/supervisor.md)
- Keywords: In-workspace init (PID 1); Manages terminals, IDEs, SSH; gRPC API; Serves workspace UI
- Used by: ide, ws-daemon, ws-manager-mk2, local-app (via API), ide-metrics (via API), ide-service (via API)
- Uses: supervisor-api, content-service-api, ws-daemon-api, ide-metrics-api, public-api, gitpod-protocol, common-go

### [workspacekit](components/workspacekit.md)
- Keywords: Workspace container init; Namespace isolation (user, mount, net); Multi-ring security; Seccomp; `lift`
- Used by: Container runtime, supervisor
- Uses: ws-daemon-api, content-service-api, common-go, libseccomp, rootlesskit, K8s API

### [ws-proxy](components/ws-proxy.md)
- Keywords: Workspace HTTP/WebSocket proxy; Port forwarding, SSH gateway; K8s CRD for routing info
- Used by: proxy (main Gitpod proxy)
- Uses: K8s API, ws-manager-api, supervisor-api, content-service-api, registry-facade-api, server (lib), common-go, gitpod-protocol

### [ide-proxy](components/ide-proxy.md)
- Keywords: Serves static IDE assets (logos, binaries); Caddy-based; Proxies to blobserve/ide-metrics
- Used by: dashboard, proxy (main)
- Uses: blobserve, ide-metrics, local-app (binaries), Caddy, OpenVSX data (static)

### [ide-service](components/ide-service.md)
- Keywords: Manages IDE configs; Resolves workspace IDE (images, versions); gRPC server; Docker registry/Experiments integration
- Used by: ws-manager-mk2, supervisor, dashboard, content-service
- Uses: ide-service-api, common-go, gitpod-protocol, Docker Registries, Experiments Service

### [ide-metrics](components/ide-metrics.md)
- Keywords: Collects IDE metrics/errors; Go service (gRPC/HTTP API); Prometheus endpoint; Label/component allowlists
- Used by: supervisor, ide (extensions/workbench), ide-proxy
- Uses: ide-metrics-api, common-go, Prometheus, Error Reporting Service (external)

### [docker-up](components/docker-up.md)
- Keywords: Rootless Docker/Compose in workspace; Auto-install, daemon mgmt; `runc-facade`; Embedded binaries
- Used by: supervisor, Workspace users (CLI/API)
- Uses: common-go, workspacekit, Container Registries, (Embedded: Docker, Compose, runc)

## Utility Components

### [common-go](components/common-go.md)
- Keywords: Shared Go library; Utilities (logging, metrics, tracing, K8s, gRPC); Reduces duplication
- Used by: Most Go-based Gitpod services (content-service, ws-daemon, etc.)
- Uses: scrubber, K8s client libs, gRPC, Prometheus client, OpenTelemetry, Logrus

### [service-waiter](components/service-waiter.md)
- Keywords: Waits for service readiness (DB, Redis, K8s); Init container utility; Ordered startup
- Used by: K8s deployments, CI/CD, Gitpod services (startup)
- Uses: MySQL (client), Redis (client), Kubernetes API, common-go, gitpod-db

### [node-labeler](components/node-labeler.md)
- Keywords: K8s controller; Node labels (service readiness); Cluster-autoscaler annotations; Monitors registry-facade/ws-daemon
- Used by: ws-manager-mk2, Cluster Autoscaler (external)
- Uses: Kubernetes API, registry-facade, ws-daemon, common-go, ws-manager-api, ws-manager-mk2 (CRDs)

### [scrubber](components/scrubber.md)
- Keywords: Go library for data sanitization (PII); Scrubs strings, JSON, structs; Redaction/hashing; Configurable rules
- Used by: common-go, server, workspace/monitoring services
- Uses: golang-lru, reflectwalk (external Go libs)

### [spicedb](components/spicedb.md)
- Keywords: Authorization (SpiceDB ReBAC); Schema (entities, relations, permissions); Fine-grained access control
- Used by: server, dashboard, public-api-server, ws-manager-mk2
- Uses: SpiceDB Service (external), YAML libs, Code gen tools

## Integration Components

### [public-api-server](components/public-api-server.md)
- Keywords: Programmatic Gitpod API (gRPC/Connect); Auth (Tokens, OIDC); Proxies to internal services; Webhooks
- Used by: External clients (integrations, tools, IDEs, CLI), proxy (main)
- Uses: server, gitpod-db, Redis, usage-api, session-service, common-go, public-api (defs), gitpod-protocol, External IDPs

### [gitpod-cli](components/gitpod-cli.md)
- Keywords: In-workspace CLI; Workspace/IDE/port/task/env control; Cobra (Go); Analytics
- Used by: Workspace users
- Uses: supervisor-api, gitpod-protocol, common-go, ide-metrics-api, public-api, Git, IDE

### [local-app](components/local-app.md)
- Keywords: Local tools (CLI, Companion); SSH/port forwarding to workspaces; Auth, self-update; Bastion tunneling
- Used by: End-users (local machine)
- Uses: supervisor-api, gitpod-protocol, local-app-api, public-api, server, ide-proxy

### [ws-manager-bridge](components/ws-manager-bridge.md)
- Keywords: ws-manager intermediary; Syncs workspace status to DB; Handles lifecycle events; Cluster mgmt API
- Used by: server, other components (via DB/Redis)
- Uses: ws-manager-api, gitpod-db, gitpod-protocol, ws-manager-bridge-api, ws-daemon-api, Redis, Prometheus

### [image-builder-bob](components/image-builder-bob.md)
- Keywords: Builds workspace images (base/workspace layers); `bob build` (Buildkit), `bob proxy` (auth); Secure registry push
- Used by: image-builder-mk3, workspacekit
- Uses: common-go, Container Registries, Buildkit

### [usage](components/usage.md)
- Keywords: Tracks workspace usage/billing; Stripe integration; Credit calculation; Scheduled jobs; Cost centers
- Used by: server, ws-manager-mk2, public-api-server
- Uses: usage-api, common-go, gitpod-db, public-api, Stripe, Redis, server (info), ws-manager-api (info)
