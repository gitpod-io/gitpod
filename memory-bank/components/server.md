# Server Component

## Overview

The Server is a central component in Gitpod that serves as the main backend service, handling API requests, authentication, user management, workspace operations, and integration with various source code management systems. It acts as the core orchestrator for the Gitpod platform, connecting various components and providing a unified API for clients.

## Purpose

The primary purposes of the Server component are:
- Provide API endpoints for client applications (dashboard, IDE, CLI)
- Handle user authentication and session management
- Manage user accounts and preferences
- Coordinate workspace creation and management
- Integrate with source code management systems (GitHub, GitLab, Bitbucket)
- Process webhooks for prebuilds and other automated operations
- Manage billing and subscription information
- Provide real-time communication via WebSockets
- Coordinate with other Gitpod components

## Architecture

The Server operates as an Express.js application with several key components:

1. **API Server**: Provides HTTP and WebSocket endpoints for client communication
2. **Authentication System**: Handles user authentication and session management
3. **Database Interface**: Interacts with the database for persistent storage
4. **WebSocket Manager**: Manages real-time communication with clients
5. **SCM Integrations**: Connects with GitHub, GitLab, Bitbucket, and other platforms
6. **Workspace Coordinator**: Manages workspace lifecycle in coordination with ws-manager
7. **Monitoring Endpoints**: Provides health checks and metrics

The server is designed as a modular application using dependency injection (Inversify) to manage components and their dependencies.

## Key Files and Structure

- `main.ts`: Entry point that initializes the container and starts the server
- `init.ts`: Handles server initialization and setup
- `server.ts`: Core server implementation
- `src/api/`: API endpoints and handlers
- `src/auth/`: Authentication and authorization
- `src/workspace/`: Workspace management
- `src/user/`: User management
- `src/prebuilds/`: Prebuild functionality
- `src/billing/`: Billing and subscription management
- `src/github/`, `src/gitlab/`, `src/bitbucket/`: SCM integrations

## Dependencies

### Internal Dependencies
- `components/gitpod-db`: Database access layer
- `components/gitpod-protocol`: Shared protocol definitions
- `components/content-service-api`: Content service API definitions
- `components/ws-manager-api`: Workspace manager API definitions
- `components/image-builder-api`: Image builder API definitions
- Various other Gitpod component APIs

### External Dependencies
- Express.js for HTTP server
- WebSocket for real-time communication
- Inversify for dependency injection
- TypeORM for database access
- Redis for caching and pub/sub
- Prometheus for metrics
- Various SCM platform SDKs

## Configuration

The Server is configured via environment variables and configuration files, including:

- Server address and port
- Database connection details
- Authentication providers
- SCM integration settings
- Feature flags
- Monitoring and logging settings

## API Services

The Server exposes multiple API endpoints:

1. **User API**: User management, authentication, and preferences
2. **Workspace API**: Workspace creation, management, and access
3. **SCM Integration APIs**: GitHub, GitLab, Bitbucket webhooks and OAuth
4. **Billing API**: Subscription and payment management
5. **WebSocket API**: Real-time communication with clients
6. **Health and Metrics API**: System health and monitoring

## Authentication and Authorization

The Server supports multiple authentication methods:

1. **Session-based Authentication**: For web clients
2. **Bearer Token Authentication**: For API access
3. **OAuth Integration**: With GitHub, GitLab, Bitbucket, etc.
4. **Personal Access Tokens**: For programmatic access

Authorization is handled through a combination of user roles, permissions, and access controls.

## Integration Points

The Server integrates with:
1. **Database**: For persistent storage
2. **Redis**: For caching and pub/sub messaging
3. **Workspace Manager**: For workspace lifecycle management
4. **Image Builder**: For custom workspace images
5. **Content Service**: For workspace content management
6. **SCM Platforms**: For repository access and webhooks
7. **Payment Providers**: For billing and subscriptions

## Security Considerations

- Implements CSRF protection for WebSocket connections
- Handles authentication and session management securely
- Validates and sanitizes user input
- Implements proper error handling and logging
- Uses HTTPS for secure communication
- Manages sensitive data securely

## Common Usage Patterns

The Server is typically used to:
1. Handle API requests from the dashboard and IDE
2. Process authentication and session management
3. Coordinate workspace creation and management
4. Handle webhooks from SCM platforms
5. Manage user accounts and preferences
6. Process billing and subscription information

## Related Components

- **Dashboard**: Frontend interface that communicates with the server
- **Workspace Manager**: Manages workspace instances
- **Content Service**: Manages workspace content
- **Image Builder**: Builds custom workspace images
- **Database**: Stores persistent data
- **IDE Service**: Provides IDE configuration
