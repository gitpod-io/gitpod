# Technical Context: Gitpod

## Technologies Used

### Programming Languages
- **Go**: Used for system-level services, performance-critical components, and Kubernetes integration
- **TypeScript**: Used for user-facing services, dashboard, and IDE integration
- **Java**: Used for JetBrains IDE integration
- **Shell Scripts**: Used for automation, build scripts, and development tools

### Frameworks & Libraries
- **React**: Frontend dashboard UI
- **gRPC**: Service-to-service communication
- **Protocol Buffers**: Data serialization
- **Kubernetes API**: Workspace orchestration
- **Docker API**: Container management
- **Leeway**: Custom build system for managing component dependencies

### Infrastructure
- **Kubernetes**: Container orchestration platform
- **Docker**: Containerization technology
- **MySQL**: Primary database for persistent data
- **Redis**: Caching and ephemeral data storage
- **Helm**: Kubernetes package management
- **Terraform**: Infrastructure as code for deployment

### Development Tools
- **VS Code**: Primary IDE for TypeScript/JavaScript development
- **GoLand/IntelliJ**: IDE for Go development
- **pre-commit**: Git hooks for code quality
- **ESLint/Prettier**: Code formatting and linting
- **Werft**: CI/CD system

## Development Setup

### Local Development
The project uses a Gitpod-based development workflow (dogfooding), with the following key aspects:

1. **Gitpod Workspace**: Development occurs in Gitpod workspaces defined by `.gitpod.yml`
2. **Component-Based**: Each component can be developed and tested independently
3. **Leeway Build System**: Manages dependencies between components
4. **Dev Containers**: Development occurs in containers that mirror production

### Build Process

Gitpod uses two primary approaches for building components:

#### 1. In-tree Builds (Primary for Local Development)
Components are built directly in the workspace using language-specific tools:

- **TypeScript/JavaScript Components**:
  - Commands are defined in each component's `package.json`
  - Common commands:
    - `yarn build`: Compiles the component
    - `yarn test`: Runs unit tests
    - `yarn lint`: Checks code style
    - `yarn watch`: Watches for changes and rebuilds automatically
  - Example (from server component):
    ```bash
    cd components/server
    yarn build        # Build the component
    yarn test:unit    # Run unit tests
    yarn test:db      # Run database tests
    ```

- **Go Components**:
  - Use standard Go tools
  - Common commands:
    - `go build`: Compiles the component
    - `go test`: Runs tests
    - `go run`: Builds and runs the component
  - Example:
    ```bash
    cd components/ws-daemon
    go build ./...    # Build all packages
    go test ./...     # Test all packages
    ```

#### 2. Leeway Builds (Out-of-tree, Primary for CI)
Leeway is a custom build tool that:
- Copies relevant sources into a separate file tree
- Manages complex dependencies between components
- Generates build artifacts for CI/CD pipelines
- Can also be run from inside the workspace

Common Leeway commands:
```bash
leeway build components/server:app    # Build a specific component
leeway build -D components/server:app # Build with dependencies
leeway exec --package components/server:app -- yarn test  # Run a command for a package
```

#### 3. Component Packaging
- **Docker Images**: Components are packaged as Docker images using `leeway.Dockerfile` files
- **Helm Charts**: Deployment configurations are managed as Helm charts for Kubernetes deployment

### Testing Strategy
1. **Unit Tests**: Component-level tests for individual functions and classes
2. **Integration Tests**: Tests for interactions between components
3. **End-to-End Tests**: Tests for complete user workflows
4. **Preview Environments**: Dedicated test environments for feature validation

## Technical Constraints

### Performance Requirements
- **Workspace Startup Time**: Workspaces should start in under 10 seconds when prebuilt
- **IDE Responsiveness**: IDE should maintain low latency even over internet connections
- **Resource Efficiency**: Efficient use of cluster resources to maximize density

### Security Constraints
- **Workspace Isolation**: Strong isolation between user workspaces
- **Least Privilege**: Components operate with minimal required permissions
- **Data Protection**: Secure handling of user code and credentials
- **Network Security**: Controlled network access between components

### Scalability Requirements
- **Horizontal Scaling**: All components must support horizontal scaling
- **Multi-Cluster Support**: Support for distributing workspaces across multiple clusters
- **Resource Limits**: Enforced limits on workspace resource consumption

### Compliance Requirements
- **GDPR Compliance**: Proper handling of user data
- **SOC2 Compliance**: Security and availability controls
- **Data Residency**: Support for region-specific data storage

## Dependencies

### External Dependencies
- **Git Providers**: GitHub, GitLab, Bitbucket, Azure DevOps
- **Container Registries**: Docker Hub, GCR, ECR
- **Cloud Providers**: GCP, AWS, Azure (for self-hosted deployments)
- **IDE Platforms**: VS Code, JetBrains IDEs

### Internal Dependencies
The system has several internal dependencies between components:

1. **Workspace Manager** depends on:
   - Kubernetes API
   - Image Builder
   - Content Service

2. **Dashboard** depends on:
   - Auth Service
   - Workspace Manager
   - Content Service

3. **IDE Service** depends on:
   - Workspace Manager
   - Content Service
   - Supervisor

4. **Content Service** depends on:
   - Git providers
   - Storage systems

5. **Supervisor** depends on:
   - IDE Service
   - Content Service

### Third-Party Libraries
Key third-party libraries and their purposes:

1. **Kubernetes Client Libraries**: Interaction with Kubernetes API
2. **Docker Client Libraries**: Container management
3. **Database Drivers**: MySQL, Redis connectivity
4. **gRPC/Protocol Buffers**: Service communication
5. **React and UI Libraries**: Dashboard frontend
6. **Authentication Libraries**: OAuth, JWT handling

## Development Workflow

1. **Feature Planning**: Features are planned and designed
2. **Implementation**: Code is written and tested locally
3. **Code Review**: Changes are reviewed through pull requests
4. **CI/CD**: Automated testing and deployment
5. **Preview**: Features are tested in preview environments
6. **Release**: Changes are deployed to production

## Technical Debt and Challenges

1. **Component Coupling**: Some components have tight coupling that could be improved
2. **Test Coverage**: Certain areas lack comprehensive test coverage
3. **Documentation**: Some internal APIs lack detailed documentation
4. **Legacy Components**: Some older components need modernization
5. **Build System Complexity**: The custom build system has a learning curve
