# System Patterns: Gitpod

## System Architecture

Gitpod follows a microservices architecture designed to be **Scalable**, **Resilient**, **Extensible**, and **Secure**.

### High-Level Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│Git Platforms│  │User Browser │  │IDE Clients  │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────┬───────┴────────┬───────┘
                ▼                ▼
        ┌───────────────────────────────┐
        │         API Gateway           │
        └───────────────────────────────┘
                │                │
       ┌────────┴───────┐ ┌─────┴────────┐
       │  Auth Service  │ │  Dashboard   │
       └────────────────┘ └──────────────┘
                │                │
       ┌────────┴───────┐ ┌─────┴────────┐
       │  WS Manager    │ │Image Builder │
       └────────────────┘ └──────────────┘
                │                │
       ┌────────┴────────────────┴────────┐
       │    Kubernetes Infrastructure     │
       └───────────────────────────────────┘
```

## Key Components

### Core Services

| Component | Purpose |
|-----------|---------|
| **Workspace Manager** | Orchestrates workspace lifecycle (creation, starting, stopping, deletion) |
| **Workspace Daemon** | Manages workspace resources and file system operations on each node |
| **Image Builder** | Builds and caches Docker images for workspaces |
| **Content Service** | Manages file content, git operations, and synchronization |
| **IDE Service** | Manages IDE instances (VS Code, JetBrains) |
| **Dashboard** | Web UI for workspace and user management |
| **Auth Service** | Handles authentication and authorization |
| **Proxy** | Routes traffic to appropriate services and workspaces |

### Supporting Components

| Component | Purpose |
|-----------|---------|
| **Registry Facade** | Efficient access to container images |
| **Blobserve** | Serves static content from container images |
| **Supervisor** | Manages workspace internal services |
| **Public API** | Programmatic access to Gitpod functionality |

## Project Structure & Code Style

### Project Organization
- Components in `components/` directory
- API definitions in `-api` suffixed packages
- gRPC services defined with Protocol Buffers (`.proto`)
- `BUILD.yaml` for build configuration
- `leeway.Dockerfile` for containerized components

### Code Style
| Language | Key Practices |
|----------|---------------|
| **Go** | Standard conventions (gofmt), explicit error handling, context propagation, structured logging |
| **TypeScript** | Type safety, React for UI, functional components with hooks, ESLint/Prettier |

## Design Patterns

| Pattern | Implementation |
|---------|----------------|
| **Microservices** | Loosely coupled services with specific responsibilities |
| **Container Orchestration** | Kubernetes for deployment, scaling, and operations |
| **Event-Driven Architecture** | Asynchronous communication for scalability and resilience |
| **API Gateway** | Central routing with cross-cutting concerns handling |
| **Immutable Infrastructure** | Configuration changes create new environments |

## Component Relationships

### Workspace Lifecycle Flow
1. User requests workspace → Auth validates → WS Manager creates spec
2. Image Builder ensures image availability → WS Manager creates K8s pod
3. WS Daemon initializes environment → Supervisor starts
4. IDE Service connects IDE → Proxy routes traffic

**Key components**: ws-manager-mk2, ws-daemon, ws-manager-bridge, server, image-builder-mk3

### Data Flow
- **User Code**: Content Service manages synchronization
- **Configuration**: Database storage, applied by WS Manager
- **Build Artifacts**: Cached by Image Builder
- **User Data**: Database storage, accessed via Dashboard/API

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Kubernetes-Based** | Scalability and standardized infrastructure |
| **Multi-IDE Support** | Flexibility for different user preferences |
| **Prebuild System** | Significantly reduced startup times |
| **Workspace Pods** | Isolation and resource management |
| **TypeScript & Go** | Balance of developer productivity and performance |
| **gRPC Communication** | Efficient, typed service communication |
| **Leeway Build System** | Management of complex component dependencies |
| **K8s Deployment Config** | Centralized in `install/installer` for consistency |
| **Public API Architecture** | gRPC services defined in Protocol Buffers |
| **SpiceDB Authorization** | Fine-grained relationship-based access control |

## Development Workflows

### PRD Workflow
1. **Requirements Gathering** (Plan): Understand problem, explore components
2. **PRD Creation** (Plan): Create document with standardized sections
3. **Implementation Planning** (Plan): Identify files to modify
4. **Implementation** (Act): Create/modify files
5. **Documentation Update** (Act): Update memory bank
6. **Verification**: Validate implementation meets requirements

### Build Approaches

- **In-tree builds** (for development in a Gitpod workspace):
  - TypeScript components: Use `yarn` commands defined in `package.json`.
    - `yarn build`: Compile the component.
    - `yarn test`: Run tests.
    - `yarn lint`: Check code style.
    - `yarn watch`: Watch for changes and rebuild.
  - Go components: Use standard Go tools.
    - `go build ./...`: Build all packages.
      - `go test ./...`: Test all packages.
      - `go run main.go`: Build and run.
- **Out-of-tree builds** (Leeway, primarily used in CI):
  - `leeway build components/component-name:app`: Build a specific component.
  - `leeway build -D components/component-name:app`: Build with dependencies.
  - `leeway exec --package components/component-name:app -- command`: Run a command for a package.


### Testing & Development
- Unit tests alongside code
- Integration tests in separate directories
- End-to-end tests in `test/` directory
- Gitpod workspaces for development (dogfooding)
- Preview environments for testing

## Documentation Patterns
- README.md for component purpose
- API docs from Protocol Buffer definitions
- Component docs in `memory-bank/components/`
- Standardized structure (Overview, Purpose, Architecture, etc.)
- API components include Code Generation section

## Known Challenges
- Build system complexity
- Component dependency understanding
- Testing environment setup

## Evolution of Project Decisions

### Memory Bank Organization
- Component documentation in separate files for:
  - Clear organization
  - Detailed documentation
  - Easy information finding
  - Incremental updates
- API component documentation separated to:
  - Define critical interfaces
  - Clarify system boundaries
  - Track API changes and versioning

## Build and Test Information
Document for each component:
- Build commands
- Test commands
- Dependencies
- Common issues
- Performance considerations

Update documentation in:
1. Component docs in `memory-bank/components/`
2. This file for general patterns
3. `techContext.md` for significant patterns
