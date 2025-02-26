# Public API Server Component

## Overview

The Public API Server is a component in Gitpod that provides a versioned, stable, and managed API for programmatic access to Gitpod functionality. It serves as the gateway for external integrations, automation, and third-party tools to interact with Gitpod's core services. The API is designed to be backward compatible, well-documented, and follows modern API design principles.

## Purpose

The primary purposes of the Public API Server component are:
- Provide a stable, versioned API for programmatic access to Gitpod
- Enable third-party integrations and community-built tools
- Offer a consistent interface for automation and orchestration
- Support authentication and authorization for API access
- Serve as the canonical way to access Gitpod functionality programmatically
- Enable richer integrations with IDEs and development platforms
- Provide OpenID Connect (OIDC) authentication capabilities
- Support identity provider functionality

## Architecture

The Public API Server is built as a Go service with several key components:

1. **gRPC API**: Core API implementation using gRPC and Connect
2. **Authentication**: Handles API tokens, session verification, and OIDC flows
3. **Proxy Layer**: Routes requests to internal Gitpod services
4. **Metrics & Logging**: Collects and exposes metrics and logs
5. **Validation**: Ensures request data meets API requirements
6. **Webhooks**: Handles external service webhooks (e.g., Stripe)

The component is designed to be the primary entry point for all programmatic interactions with Gitpod, abstracting away internal implementation details and providing a stable interface.

## Key Files and Structure

- `main.go`: Entry point for the application
- `cmd/root.go`: Command-line interface setup
- `cmd/run.go`: Main server run command
- `pkg/server/server.go`: Core server implementation
- `pkg/apiv1/`: API service implementations
- `pkg/auth/`: Authentication and authorization
- `pkg/oidc/`: OpenID Connect implementation
- `pkg/identityprovider/`: Identity provider functionality
- `pkg/proxy/`: Request proxying to internal services
- `pkg/webhooks/`: Webhook handlers

## API Services

The Public API Server provides several services:

1. **Workspaces Service**: Manage workspaces (create, start, stop, delete)
2. **Teams Service**: Manage teams and team membership
3. **User Service**: User information and management
4. **SCM Service**: Source code management integrations
5. **Editor Service**: IDE and editor configuration
6. **IDE Client Service**: IDE client interactions
7. **Projects Service**: Project management
8. **OIDC Service**: OpenID Connect authentication
9. **Identity Provider Service**: Identity provider functionality
10. **Tokens Service**: Personal access token management

## Authentication

The component supports multiple authentication methods:

1. **Personal Access Tokens**: Long-lived tokens for API access
2. **Session Authentication**: Browser session-based authentication
3. **OIDC Authentication**: OpenID Connect flows for third-party authentication
4. **Webhook Signatures**: Verification of webhook payloads

Authentication is implemented using JSON Web Signatures (JWS) with both RSA-256 and HMAC-SHA256 algorithms.

## Configuration

The Public API Server is configured through a JSON configuration file:

```json
{
  "server": {
    "port": 3000,
    "address": "0.0.0.0"
  },
  "gitpodServiceURL": "https://gitpod.io/api",
  "publicURL": "https://api.gitpod.io",
  "sessionServiceAddress": "session-service:3000",
  "databaseConfigPath": "/etc/gitpod/db",
  "redis": {
    "address": "redis:6379"
  },
  "auth": {
    "pki": {
      "privateKeyPath": "/etc/gitpod/auth/private-key.pem",
      "publicKeyPath": "/etc/gitpod/auth/public-key.pem"
    },
    "session": {
      "cookieName": "gp:session",
      "maxAgeMs": 259200000
    }
  },
  "personalAccessTokenSigningKeyPath": "/etc/gitpod/auth/pat-key",
  "stripeWebhookSigningSecretPath": "/etc/gitpod/stripe/webhook-secret",
  "billingServiceAddress": "billing-service:3000"
}
```

## Dependencies

### Internal Dependencies
- `components/common-go`: Common Go utilities
- `components/public-api`: API definitions
- `components/usage-api`: Usage API definitions
- `components/gitpod-protocol`: Gitpod protocol definitions
- `components/gitpod-db`: Database access

### External Dependencies
- gRPC and Connect for API implementation
- Redis for caching and session management
- GORM for database access
- Chi router for HTTP routing
- Prometheus for metrics

## Integration Points

The Public API Server integrates with:
1. **Gitpod Server**: For core Gitpod functionality
2. **Database**: For persistent storage
3. **Redis**: For caching and session management
4. **Billing Service**: For billing-related operations
5. **Session Service**: For session management
6. **External Identity Providers**: For authentication

## Security Considerations

The component implements several security measures:

1. **Token Signing**: Secure signing of personal access tokens
2. **Session Verification**: Validation of user sessions
3. **Webhook Signature Verification**: Ensures webhook payloads are authentic
4. **CORS Protection**: Controls cross-origin requests
5. **Encryption**: Database encryption for sensitive data
6. **Logging**: Comprehensive logging for security auditing

## Metrics

The component exposes various metrics:

- Request counts and latencies
- Error rates
- Authentication failures
- Proxy performance
- OIDC flow completions

## Common Usage Patterns

The Public API Server is typically used to:
1. Create and manage workspaces programmatically
2. Integrate Gitpod with CI/CD pipelines
3. Build custom dashboards and management tools
4. Automate workspace provisioning
5. Implement custom authentication flows
6. Integrate with third-party services

## Related Components

- **Server**: Provides the core functionality that the Public API exposes
- **Database**: Stores user, workspace, and other data
- **Proxy**: Routes incoming traffic to appropriate services
- **Billing Service**: Handles billing-related operations
- **Session Service**: Manages user sessions
