# Public API

## Overview
The Public API defines the gRPC interfaces for programmatic access to Gitpod functionality. It serves as the canonical way for external integrations, automation, and third-party tools to interact with Gitpod's core services. The API is structured into two packages (stable and experimental) with different compatibility guarantees and is designed to be backward compatible, well-documented, and follow modern API design principles.

## Purpose
This API provides a standardized interface for:
- Programmatically managing workspaces (create, start, stop, delete)
- Accessing and managing user information
- Working with organizations and teams
- Managing projects and repositories
- Integrating with source code management systems
- Configuring editors and IDEs
- Authenticating via OpenID Connect
- Managing personal access tokens
- Automating Gitpod workflows

## Architecture
The Public API is implemented as a set of gRPC services defined in Protocol Buffer files. These definitions are used to generate client and server code in Go, TypeScript, and Java. The API is exposed on `api.gitpod.io` or `api.<domain>` for Dedicated installations.

The API is structured into two main packages:

1. **Stable (v1)**:
   - Located in `gitpod/v1/`
   - Provides compatibility guarantees
   - Services, calls, types, and fields are not removed without following a deprecation policy
   - Services, calls, types, and fields are not renamed
   - Non-successful responses are described exhaustively
   - **Implementation**: Directly implemented in the server component using Connect

2. **Experimental**:
   - Located in `gitpod/experimental/v1/`
   - Provides no compatibility guarantees
   - May change frequently
   - **Implementation**: Handled in the public-api-server component, and either:
     - Implemented directly in Go
     - Forwarded to the old websocket API in the server component

## Implementation Patterns

### Stable API Implementation
The stable API (v1) is implemented directly in the server component using Connect. This means:
- The server component handles the business logic for these API endpoints
- The implementation is in TypeScript using Connect

### Experimental API Implementation
The experimental API is handled in the public-api-server component in two ways:

1. **Direct Implementation**:
   - Some services are implemented directly in Go within the public-api-server
   - These implementations handle the business logic directly
   - They may interact with the database or other services directly

2. **Forwarded Implementation**:
   - Other services forward requests to the old websocket API in the server component
   - The public-api-server acts as a proxy, translating gRPC requests to websocket API calls
   - The server component handles the actual business logic
   - This approach is often used for functionality that already exists in the server component

## Key Services

### Stable API (v1)
All implemented in server component using Connect:
- WorkspaceService
- OrganizationService
- UserService
- TokenService
- SCMService
- AuthProviderService
- ConfigurationService
- EnvVarService
- InstallationService
- PrebuildService
- SSHService
- VerificationService

### Experimental API
Implemented in public-api-server:
- WorkspacesService (Forwarded to server)
- TeamsService (Directly implemented in Go)
- ProjectsService (Forwarded to server)
- EditorService (Directly implemented in Go)
- IDEClientService (Directly implemented in Go)
- OIDCService (Directly implemented in Go)
- IdentityProviderService (Directly implemented in Go)
- TokensService (Forwarded to server)
- UserService (Forwarded to server)
- StatsService (Directly implemented in Go)

## Communication Patterns
- The API uses gRPC for efficient, typed communication
- Connect is used for the stable API implementation
- Requests include authentication tokens for identifying the user
- Pagination is supported for listing operations
- Streaming is used for real-time updates (e.g., workspace status changes)
- Field masks are used to specify which fields to return or update

### Implementation-specific Patterns
- **Stable API (v1)**:
  - Requests are handled by the server component using Connect
  - The public-api-server routes requests to the server component

- **Experimental API**:
  - Directly implemented services handle requests in the public-api-server
  - Forwarded services translate gRPC requests to websocket API calls to the server component

## Dependencies
- **Server Component**: Implements the stable API and handles forwarded experimental API requests
- **Public-api-server Component**: Implements experimental APIs directly or forwards to server
- **Database**: Stores user, workspace, and organization data
- **Redis**: Used for caching and session management
- **gRPC and Connect**: Used for API implementation
- **Protocol Buffers**: Used for API definition and code generation

## Usage Examples
- Creating and managing workspaces programmatically
- Building custom dashboards and management tools
- Integrating Gitpod with CI/CD pipelines
- Automating workspace provisioning
- Building IDE extensions that interact with Gitpod
- Implementing custom authentication flows
- Integrating with third-party services

## Version Compatibility
The API uses Protocol Buffers version 3 (proto3) syntax, which provides forward and backward compatibility features.

### Stable API (v1)
- Services, calls, types, and fields are not removed without following a deprecation policy
- Services, calls, types, and fields are not renamed
- Non-successful responses are described exhaustively
- Changes require an API User Experience review

### Experimental API
- No compatibility guarantees
- May change frequently
- Should not be relied upon for production use

## Code Generation and Building

### Regenerating Code from Protobuf Definitions
The Public API uses Protocol Buffers and gRPC for defining interfaces. When changes are made to the `.proto` files, the corresponding code in Go, TypeScript, and Java needs to be regenerated.

To regenerate the code:

1. Navigate to the public-api directory:
   ```bash
   cd components/public-api
   ```

2. Run the generate script:
   ```bash
   ./generate.sh
   ```

3. Rebuild the typescript code:
   ```bash
   cd typescript-commond && yarn build
   ```

This script performs the following actions:
- Installs necessary dependencies
- Lints the proto files using buf
- Runs breaking change detection against the main branch
- Removes previously generated files
- Generates Go, TypeScript, and Java code using buf
- Updates license headers
- Runs formatting tools
- Builds the TypeScript package

### Building After Code Generation
After regenerating the code, you may need to rebuild components that depend on the Public API. This typically involves:

1. For Go components:
   ```bash
   cd <component-directory>
   go build ./...
   ```

2. For TypeScript components:
   ```bash
   cd <component-directory>
   yarn install
   yarn build
   ```

3. Using Leeway (for CI/CD):
   ```bash
   leeway build -D components/<component-name>:app
   ```

The Public API is a critical component for enabling programmatic access to Gitpod functionality. It enables third-party integrations, automation, and custom tooling to interact with Gitpod in a standardized, versioned way.
