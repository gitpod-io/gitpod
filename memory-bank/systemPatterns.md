# System Patterns: Gitpod

## System Architecture

Gitpod follows a microservices architecture composed of several key components that work together to provide the complete development environment platform. The system is designed to be:

- **Scalable**: Handles many concurrent users and workspaces
- **Resilient**: Maintains availability despite component failures
- **Extensible**: Allows for adding new features and integrations
- **Secure**: Isolates workspaces and protects user data

### High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Git Platforms  │     │  User Browser   │     │  IDE Clients    │
│  (GitHub, etc.) │     │                 │     │  (VS Code, etc.)│
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                           API Gateway                           │
└─────────────────────────────────────────────────────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Auth Service   │     │  Dashboard      │     │  IDE Service    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         └───────────────┬───────┴───────────────┬───────┘
                         │                       │
                         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  WS Manager     │     │  Image Builder  │     │  Content Service│
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Kubernetes Infrastructure                    │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### Core Services

1. **Workspace Manager (ws-manager)**: Orchestrates workspace lifecycle, managing creation, starting, stopping, and deletion of workspaces.

2. **Workspace Daemon (ws-daemon)**: Runs on each node, managing workspace resources, file system operations, and runtime aspects.

3. **Image Builder**: Builds Docker images for workspaces based on configuration and caches them for quick startup.

4. **Content Service**: Manages file content, including git operations, file synchronization, and backup.

5. **IDE Service**: Manages the IDE instances (VS Code, JetBrains) that run in workspaces.

6. **Dashboard**: Web UI for managing workspaces, projects, and user settings.

7. **Auth Service**: Handles authentication and authorization across the platform.

8. **Proxy**: Routes traffic to the appropriate services and workspaces.

### Supporting Components

1. **Registry Facade**: Provides efficient access to container images.

2. **Blobserve**: Serves static content from container images.

3. **Supervisor**: Runs inside each workspace, managing the workspace's internal services.

4. **Public API**: Provides programmatic access to Gitpod functionality.

## Project Structure Patterns

- **Component Organization**: The project is organized into components, each with its own directory in the `components/` folder.
- **API Definitions**: API definitions are typically in separate packages with `-api` suffix (e.g., `content-service-api`).
- **Protocol Buffers**: gRPC service definitions use Protocol Buffers (`.proto` files).
- **Build Configuration**: Each component has a `BUILD.yaml` file defining its build configuration.
- **Docker Configuration**: Components that run as containers have a `leeway.Dockerfile`.

## Code Style Preferences

### Go Code
- Follow standard Go conventions (gofmt).
- Error handling with explicit checks.
- Context propagation for cancellation.
- Structured logging.

### TypeScript Code
- Use TypeScript for type safety.
- React for UI components.
- Functional components with hooks.
- ESLint and Prettier for formatting.

## Design Patterns

### Microservices Pattern
Gitpod is built as a collection of loosely coupled services, each with a specific responsibility. This enables independent scaling, deployment, and maintenance of components.

### Container Orchestration
Kubernetes is used to manage the deployment, scaling, and operation of application containers across clusters of hosts.

### Event-Driven Architecture
Components communicate through events for asynchronous operations, improving scalability and resilience.

### API Gateway Pattern
A central API gateway routes requests to appropriate services, handling cross-cutting concerns like authentication.

### Immutable Infrastructure
Workspaces are treated as immutable, with changes to configuration resulting in new environments rather than modifications to existing ones.

## Component Relationships

### Workspace Lifecycle

1. User requests a workspace through the dashboard or Git integration.
2. Auth service validates the request.
3. Workspace Manager creates the workspace specification.
4. Image Builder ensures the required image is available.
5. Workspace Manager instructs Kubernetes to create the workspace pod.
6. Workspace Daemon initializes the workspace environment.
7. Supervisor starts within the workspace.
8. IDE Service connects the IDE to the workspace.
9. Proxy routes user traffic to the workspace.

The key components involved in the workspace lifecycle include:
 - workspace-manager-mk2
 - ws-daemon
 - ws-manager-bridge
 - server
 - image-builder-mk3

### Data Flow

1. **User Code**: Managed by Content Service, synchronized between workspace and git repositories
2. **Configuration**: Stored in database, applied by Workspace Manager during workspace creation
3. **Build Artifacts**: Cached by Image Builder for reuse in future workspaces
4. **User Data**: Stored in database, accessed through Dashboard and API

## Key Technical Decisions

1. **Kubernetes-Based**: Leveraging Kubernetes for container orchestration provides scalability and standardized infrastructure management.

2. **Multi-IDE Support**: Supporting multiple IDEs (VS Code, JetBrains) increases flexibility for users with different preferences.

3. **Prebuild System**: Prebuilding environments before they're needed significantly reduces startup times.

4. **Workspace Pods**: Each workspace runs in its own Kubernetes pod, providing isolation and resource management.

5. **TypeScript and Go**: Core services are implemented in TypeScript (user-facing) and Go (system-level), balancing developer productivity and performance.

6. **gRPC Communication**: Internal services communicate using gRPC for efficient, typed communication.

7. **Leeway Build System**: Custom build system for managing the complex dependencies between components.

8. **Kubernetes Deployment Configuration**: All code that defines Kubernetes objects for deployable components lives in `install/installer`. This centralized approach ensures consistent deployment patterns across all components.

9. **Public API Architecture**: External programmatic access is provided via `gitpod.v1` gRPC services. These services are defined using Protocol Buffers (`.proto` files) located in the `components/public-api/gitpod/v1/` directory. The `server` component (TypeScript/Express.js based) directly implements and hosts these gRPC services. The `public-api-server` component (Go based) can act as an external-facing gRPC gateway.

10. **Authorization with SpiceDB**: Fine-grained, relationship-based access control (ReBAC) is managed by SpiceDB. The authorization schema, defining resources, relationships, and permissions, is located in `components/spicedb/schema/schema.yaml`. Service implementations (e.g., within the `server` component) query SpiceDB to enforce these permissions.

## Development Workflows

### Product Requirements Document (PRD) Workflow
Gitpod uses a structured PRD workflow for feature development to ensure proper planning, documentation, and implementation:

1.  **Requirements Gathering** (Plan Mode): Understand the problem, explore existing components, gather information.
2.  **PRD Creation** (Plan Mode): Create a detailed document in `prd/` (e.g., `NNN-featurename.md`) with standardized sections: Overview, Background, Requirements, Implementation Details, Testing, Deployment Considerations, Future Improvements
3.  **Implementation Planning** (Plan Mode): Identify files to modify and plan the approach
4.  **Implementation** (Act Mode): Create/modify necessary files following the plan
5.  **Documentation Update** (Act Mode): Update memory bank with new knowledge
6.  **Verification**: Ensure implementation meets requirements and documentation is complete

This workflow ensures thorough planning, clear documentation, and knowledge preservation for all feature development.

### Build Approaches

-   **In-tree builds** (for development in a Gitpod workspace):
    -   TypeScript components: Use `yarn` commands defined in `package.json`.
        -   `yarn build`: Compile the component.
        -   `yarn test`: Run tests.
        -   `yarn lint`: Check code style.
        -   `yarn watch`: Watch for changes and rebuild.
    -   Go components: Use standard Go tools.
        -   `go build ./...`: Build all packages.
        -   `go test ./...`: Test all packages.
        -   `go run main.go`: Build and run.
-   **Out-of-tree builds** (Leeway, primarily used in CI):
    -   `leeway build components/component-name:app`: Build a specific component.
    -   `leeway build -D components/component-name:app`: Build with dependencies.
    -   `leeway exec --package components/component-name:app -- command`: Run a command for a package.

### Testing

-   Unit tests alongside code.
-   Integration tests in separate directories.
-   End-to-end tests in the `test/` directory.
-   Component-specific test commands in `package.json` (for TypeScript).
-   Go tests use standard `go test` command.

### Local Development

-   Use Gitpod workspaces for development (dogfooding).
-   Components can be run individually for testing.
-   Preview environments for testing changes.
-   Use in-tree builds for rapid iteration during development.

## Known Challenges

- **Build System Complexity**: The Leeway build system has a learning curve.
- **Component Dependencies**: Understanding dependencies between components can be challenging.
- **Testing Environment**: Setting up proper testing environments for all components.

## Tool Usage Patterns

- **VS Code**: Primary IDE for TypeScript development.
- **GoLand/IntelliJ**: Often used for Go development.
- **Docker**: Used for containerized development and testing.
- **kubectl**: Used for interacting with Kubernetes clusters.
- **Werft**: CI/CD system for automated builds and tests.

## Documentation Patterns

- **README.md**: Each component should have a README explaining its purpose.
- **API Documentation**: Generated from Protocol Buffer definitions.
- **Memory Bank Documentation**:
    - Component-specific documentation is stored in `memory-bank/components/` directory.
    - Each component gets its own markdown file with detailed information about its purpose, architecture, and implementation.
    - Component documentation should focus on both service components that implement business logic and API components that define interfaces.
    - Documentation follows a consistent structure with sections for Overview, Purpose, Architecture, Key Features, etc.
    - API component documentation should include a "Code Generation and Building" section that explains:
        - How to regenerate code from protobuf definitions.
        - The implementation details of the generation process.
        - How to build components that depend on the API after regeneration.

## Evolution of Project Decisions

This section captures how and why certain architectural and design decisions were made.

### Memory Bank Organization

- **Component Documentation**: The decision to create separate documentation files for each component in the `memory-bank/components/` directory was made to:
    1. Provide a clear, organized structure for component documentation.
    2. Allow for detailed documentation of each component's purpose, architecture, and implementation.
    3. Make it easier to find information about specific components.
    4. Enable incremental updates to component documentation without affecting other files.
- **API Component Documentation**: The decision to include "*-api" components in separate documentation was made because:
    1. API components define critical interfaces between services.
    2. Understanding these interfaces is essential for developers working across components.
    3. API documentation helps clarify system boundaries and communication patterns.
    4. Separate documentation makes it easier to track API changes and versioning.

## User Preferences

This section will be updated as specific user preferences for working with the codebase are identified.

## Build and Test Information

When working with components, it is crucial to document the following:

- **Build Commands**: Document any new or component-specific build commands encountered.
- **Test Commands**: Document how to run tests for each component.
- **Dependencies**: Note any special dependencies required for building or testing.
- **Common Issues**: Document common build or test issues and their solutions.
- **Performance Considerations**: Note any performance considerations for builds.

Whenever new build patterns or commands are encountered, the following should be updated:
1. The relevant component documentation in `memory-bank/components/`.
2. This `systemPatterns.md` file (previously the learning journal) with general patterns.
3. The `techContext.md` file if it represents a significant pattern.

This information is critical for effective development work, as being able to build and test components is fundamental to making changes and verifying their correctness.
