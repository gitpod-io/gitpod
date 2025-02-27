# Active Context: Gitpod

## Current Work Focus

We are focusing on understanding the Gitpod codebase and architecture. The primary goal is to build a comprehensive knowledge base that will allow for effective development, troubleshooting, and enhancement of the Gitpod platform.

Key areas of focus include:

1. **System Architecture Understanding**: Mapping out the relationships between components and services
2. **Component Documentation**: Creating detailed documentation for each component
3. **Development Workflow**: Understanding how to effectively develop and test changes
4. **Documentation**: Maintaining a comprehensive memory bank for future reference

## Recent Changes

- Created the initial memory bank structure with core files
- Added a components subdirectory to the memory bank
- Created detailed documentation for key components:
  - blobserve: Service that provides static assets from OCI images
  - content-service: Manages various types of content within the platform
  - dashboard: Web-based user inSterface for Gitpod
  - ws-manager-mk2: Kubernetes controller for managing workspace lifecycle
  - supervisor: Init process that runs inside each workspace container
  - ws-daemon: Node-level daemon for workspace operations
  - ide-service: Manages IDE configurations and resolves workspace IDE requirements
  - registry-facade: Modifies container images by adding layers for workspaces
  - image-builder-mk3: Builds custom workspace images from user-defined Dockerfiles
  - server: Main backend service handling API requests and user management
  - proxy: Main entry point for all HTTP and WebSocket traffic
  - ws-proxy: Handles routing and proxying of traffic to workspaces
  - gitpod-cli: Command-line interface for interacting with Gitpod workspaces
  - gitpod-db: Database layer for the Gitpod platform
  - gitpod-protocol: Core type definitions and shared protocol library
  - ide: Packages and manages IDEs available in Gitpod workspaces
  - ide-proxy: Serves static IDE-related assets and proxies requests
  - ws-manager-bridge: Bridges between workspace managers and the rest of the platform
  - ide-metrics: Collects and processes metrics and error reports from IDE components
  - local-app: Provides tools for interacting with Gitpod workspaces from local machine
  - public-api-server: Provides a stable, versioned API for programmatic access to Gitpod
  - usage: Tracks, calculates, and manages workspace usage and billing
  - common-go: Foundational Go library providing shared utilities across services
  - workspacekit: Manages container setup and namespace isolation for workspaces
  - spicedb: Provides authorization and permission management
  - scrubber: Removes or masks sensitive information from data
  - service-waiter: Waits for services to become available
  - docker-up: Sets up and manages Docker within workspace containers
  - image-builder-bob: Builds and pushes workspace images during workspace startup
  - node-labeler: Manages node labels and annotations for workspace scheduling
  - openvsx-proxy: Caching proxy service for the OpenVSX registry
  - scheduler-extender: Extends Kubernetes scheduling capabilities for workspaces
  - ipfs: Provides distributed content-addressable storage for container images
- Created documentation for API components:
  - content-service-api: Interfaces for managing workspace content, blobs, logs, and IDE plugins
  - ide-metrics-api: Interfaces for collecting metrics and error reports from IDE components
  - ide-service-api: Interfaces for managing IDE configurations and resolving workspace IDE requirements
  - image-builder-api: Interfaces for building Docker images for workspaces
  - local-app-api: Interfaces for communication between local machines and remote workspaces
  - registry-facade-api: Interfaces for dynamically assembling workspace container images
  - supervisor-api: Interfaces for workspace management, terminal handling, and port forwarding
  - usage-api: Interfaces for tracking, calculating, and managing workspace usage and billing
  - ws-daemon-api: Interfaces for workspace content management and container operations
  - ws-manager-api: Interfaces for managing the lifecycle of workspaces in Kubernetes clusters
  - ws-manager-bridge-api: Interfaces for dynamic management of workspace clusters
- Enhanced API component documentation with code generation information:
  - Added details on how to regenerate code from protobuf definitions
  - Documented the implementation details of the generation process
  - Included instructions for building components after code regeneration
  - Updated .clinerules to standardize API documentation with code generation sections

As work progresses, this section will continue to be updated to reflect:
- Additional component documentation
- Code changes implemented
- Bug fixes
- Feature additions
- Refactoring efforts

## Next Steps

The immediate next steps are:

1. **Explore Component Interactions**: Understand how components interact with each other
2. **Set Up Development Environment**: Configure a local development environment for effective testing
3. **Explore Build System**: Gain hands-on experience with both in-tree and Leeway builds
4. **Test Component Builds**: Practice building and testing different component types
5. **Identify Initial Tasks**: Determine specific tasks or improvements to focus on
6. **Establish Testing Approach**: Define how changes will be tested and validated
7. **Update Memory Bank**: Continue to refine and expand the memory bank as new information is discovered

## Active Decisions and Considerations

### Architecture Decisions

- **Component Boundaries**: Understanding and respecting the boundaries between different microservices
- **API Contracts**: Maintaining compatibility with existing API contracts
- **Performance Considerations**: Ensuring changes maintain or improve performance characteristics

### Development Approach

- **Testing Strategy**: Determining appropriate testing approaches for different types of changes
- **Documentation Standards**: Establishing standards for code documentation and memory bank updates
- **Collaboration Model**: Defining how to effectively collaborate with the team

### Technical Considerations

- **Backward Compatibility**: Ensuring changes maintain compatibility with existing clients and integrations
- **Security Implications**: Evaluating security implications of any changes
- **Scalability**: Considering how changes impact system scalability

## Current Questions and Uncertainties

As we begin working with the Gitpod codebase, several questions and uncertainties exist:

1. **Component Interactions**: How do the various components interact in specific scenarios?
2. **Performance Bottlenecks**: What are the current performance bottlenecks in the system?
3. **Testing Approach**: What is the most effective way to test changes to different components?
4. **Deployment Process**: What is the process for deploying changes to production?
5. **Feature Priorities**: What features or improvements are currently prioritized?

These questions will be addressed as we continue to explore the codebase and work with the system.

## Active Experiments

No active experiments are currently in progress. This section will be updated as experiments are designed and conducted to test hypotheses about the system or potential improvements.

## Recent Learnings

Initial exploration of the Gitpod codebase has revealed:

- **Microservices Architecture**: Gitpod is built as a collection of loosely coupled services, each with specific responsibilities
- **Go and TypeScript**: Backend services are primarily written in Go, while frontend components use TypeScript/React
- **Kubernetes Native**: Many components are designed as Kubernetes controllers or operators
- **gRPC Communication**: Services communicate using gRPC for efficient, typed communication
- **Component Patterns**: Components follow consistent patterns:
  - Go services typically have a cmd/ directory with command implementations
  - TypeScript services use React and modern frontend practices
  - Most components have a clear separation between API definitions and implementations
- **Build System Approaches**: Gitpod uses two primary approaches for building components:
  - **In-tree builds**: Using language-specific tools (yarn, go) directly in the workspace
    - Primary method for local development
    - TypeScript components use commands defined in package.json (yarn build, yarn test, etc.)
    - Go components use standard Go tools (go build, go test, etc.)
  - **Out-of-tree builds**: Using Leeway, a custom build tool
    - Primary method for CI to generate build artifacts
    - Works by copying relevant sources into a separate file tree
    - Can also be run from inside the workspace
    - Manages complex dependencies between components

This section will be continuously updated as new insights are gained through working with the system.
