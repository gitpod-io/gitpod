# Gitpod Components Index

This index provides an overview of all Gitpod components with brief descriptions of their functionality and relationships. Use this as a starting point to explore the detailed documentation for each component.

## Core Services

### server
- Primary backend service that handles user sessions, workspaces, and authentication
- Integrates with gitpod-db for persistence and ws-manager for workspace lifecycle
- Exposes REST and gRPC APIs for frontend and other services

### content-service
- Manages workspace content, blobs, and file operations
- Provides APIs for workspace initialization and content access
- Used by workspace manager and IDE components

### ws-manager-mk2
- Manages the lifecycle of workspaces in Kubernetes
- Handles workspace creation, starting, stopping, and deletion
- Communicates with ws-daemon for workspace-specific operations

### ws-daemon
- Runs on each Kubernetes node to manage workspace resources
- Handles workspace filesystem operations and resource constraints
- Communicates with content-service for content management

### image-builder-mk3
- Builds workspace images based on Gitpod configuration
- Manages image caching and layer optimization
- Integrates with registry-facade for image storage

## API Components

### content-service-api
- Defines gRPC interfaces for content service operations
- Provides protocols for workspace content, blobs, logs, and plugins
- Used by multiple components to interact with content-service

### ws-manager-api
- Defines interfaces for workspace management operations
- Provides protocols for workspace creation, control, and monitoring
- Used by server and ws-manager-bridge

### ws-daemon-api
- Defines interfaces for workspace node-level operations
- Provides protocols for filesystem, network, and resource management
- Used by ws-manager and ws-daemon

### image-builder-api
- Defines interfaces for workspace image building
- Provides protocols for build requests and status reporting
- Used by server and image-builder components

### supervisor-api
- Defines interfaces for in-workspace supervision
- Provides protocols for IDE integration and workspace services
- Used by supervisor and IDE components

### registry-facade-api
- Defines interfaces for container registry operations
- Provides protocols for image access and manipulation
- Used by registry-facade and other components

### ide-service-api
- Defines interfaces for IDE service operations
- Provides protocols for IDE instance management
- Used by IDE-related components

### ide-metrics-api
- Defines interfaces for IDE metrics collection
- Provides protocols for reporting and querying metrics
- Used by IDE components and monitoring systems

### ws-manager-bridge-api
- Defines interfaces for workspace manager bridge operations
- Provides protocols for cluster management and workspace routing
- Used by ws-manager-bridge and related components

### usage-api
- Defines interfaces for usage tracking and billing
- Provides protocols for reporting and querying usage data
- Used by server and usage components

### local-app-api
- Defines interfaces for local application integration
- Provides protocols for local environment communication
- Used by local-app and server components

## Frontend Components

### dashboard
- Web-based user interface for Gitpod
- Provides workspace management, settings, and account features
- Communicates with server via REST and WebSocket APIs

### ide
- Integrated development environment components
- Provides code editing, terminal, and development tools
- Integrates with supervisor for workspace interaction

## Infrastructure Components

### proxy
- Handles all external HTTP traffic to Gitpod
- Routes requests to appropriate backend services
- Manages TLS termination and request authentication

### registry-facade
- Provides access to container images
- Handles authentication and caching for image operations
- Integrates with external container registries

### blobserve
- Serves static assets from container images
- Extracts and caches content from image layers
- Provides efficient access to workspace resources

### ipfs
- Distributed file system component for content sharing
- Enables efficient content distribution across nodes
- Used for workspace snapshots and content caching

### openvsx-proxy
- Proxies requests to OpenVSX registry for VS Code extensions
- Caches extensions for improved performance
- Integrates with IDE components

### scheduler-extender
- Extends Kubernetes scheduler for workspace-specific logic
- Optimizes workspace placement on nodes
- Integrates with Kubernetes scheduling system

## Database and Storage

### gitpod-db
- Database access layer for Gitpod services
- Provides typed interfaces for data operations
- Used by server and other components for persistence

### gitpod-protocol
- Defines core data structures and protocols
- Provides TypeScript interfaces for Gitpod entities
- Used by multiple components for consistent data handling

## Workspace Components

### supervisor
- Runs inside each workspace to manage services
- Coordinates IDE components and workspace tools
- Communicates with ws-daemon and content-service

### workspacekit
- Low-level workspace container initialization
- Manages user permissions and environment setup
- First process that runs in workspace containers

### ws-proxy
- Routes traffic to the correct workspace
- Handles authentication and access control
- Integrates with proxy for external access

### ide-proxy
- Routes traffic to the correct IDE instance
- Manages IDE-specific routing and access control
- Integrates with supervisor for IDE coordination

### ide-service
- Manages IDE instances and configurations
- Handles IDE startup, shutdown, and updates
- Communicates with supervisor for workspace integration

### ide-metrics
- Collects and reports metrics from IDE instances
- Provides insights into IDE usage and performance
- Integrates with monitoring systems

### docker-up
- Manages Docker container lifecycle
- Used for local development environments
- Provides consistent Docker operations

## Utility Components

### common-go
- Shared Go libraries used across components
- Provides utilities for logging, configuration, and more
- Used by most Go-based components

### service-waiter
- Utility for waiting for services to be ready
- Used during startup sequences
- Ensures dependencies are available before proceeding

### node-labeler
- Labels Kubernetes nodes based on capabilities
- Used for workspace scheduling optimization
- Integrates with Kubernetes cluster management

### scrubber
- Cleans up unused resources
- Manages garbage collection of workspaces and images
- Ensures efficient resource utilization

### spicedb
- Authorization system component
- Manages fine-grained permissions
- Integrates with server for access control

## Integration Components

### public-api-server
- Provides public API endpoints for external integrations
- Implements the Gitpod API for programmatic access
- Communicates with server for core operations

### gitpod-cli
- Command-line interface for Gitpod
- Provides local development tools and workspace management
- Communicates with server and local-app

### local-app
- Desktop application for local Gitpod integration
- Provides system-level features like SSH key management
- Bridges between local environment and Gitpod services

### ws-manager-bridge
- Bridges between ws-manager instances and DB/server
- Enables multi-cluster workspace management
- Provides basic APIs to register/unregister clusters at runtime

### image-builder-bob
- Alternative image builder implementation
- Specialized for certain build scenarios
- Integrates with image-builder-mk3 and registry-facade

### usage
- Tracks and reports resource usage
- Provides billing and quota management
- Integrates with server for user-specific tracking
