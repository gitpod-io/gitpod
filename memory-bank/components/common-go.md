# Common-Go Component

## Overview

The Common-Go component is a foundational Go library that provides shared utilities, abstractions, and functionality used across multiple Gitpod services. It serves as a central repository for common code patterns, helping to maintain consistency, reduce duplication, and simplify development across the Gitpod platform's Go-based microservices.

## Purpose

The primary purposes of the Common-Go component are:
- Provide shared utilities and abstractions for Gitpod's Go-based services
- Ensure consistent implementation of cross-cutting concerns
- Reduce code duplication across services
- Simplify service development with ready-to-use components
- Standardize logging, metrics, tracing, and server configuration
- Offer common patterns for Kubernetes integration
- Provide utilities for gRPC communication
- Support consistent error handling and debugging

## Architecture

The Common-Go component is structured as a collection of Go packages, each focusing on a specific area of functionality:

1. **Baseserver**: Core server implementation with standardized configuration
2. **Log**: Structured logging utilities
3. **Tracing**: Distributed tracing functionality
4. **gRPC**: Utilities for gRPC communication
5. **Kubernetes**: Kubernetes client and utilities
6. **Analytics**: Analytics tracking and reporting
7. **Experiments**: Feature flag and experimentation support
8. **Metrics**: Prometheus metrics collection
9. **Utilities**: Various helper functions and utilities

The component is designed to be imported and used by other Go-based services in the Gitpod platform, providing a consistent foundation for service development.

## Key Packages and Functionality

### Baseserver
- Standard server implementation with HTTP and gRPC support
- Consistent configuration and option handling
- Health check endpoints
- Graceful shutdown
- Metrics integration

### Log
- Structured logging based on logrus
- Context-aware logging
- Log level management
- Field-based logging
- Metrics integration for log counts

### Tracing
- Distributed tracing with OpenTelemetry
- Span creation and management
- Context propagation
- Prometheus integration for tracing metrics

### gRPC
- Standard gRPC server and client configuration
- Authentication and authorization middleware
- Rate limiting
- Error handling
- Metrics collection

### Kubernetes
- Kubernetes client configuration
- Custom resource definitions
- Controller patterns
- Informer and lister utilities

### Analytics
- Event tracking
- User and session identification
- Batch processing of analytics events
- Privacy-aware data collection

### Experiments
- Feature flag management
- A/B testing support
- Gradual rollout capabilities
- User segmentation

### Metrics
- Prometheus metrics collection
- Standard metric types (counters, gauges, histograms)
- Metric registration and exposure
- Label standardization

### Utilities
- String manipulation
- Time handling
- Error wrapping
- JSON utilities
- Network helpers

## Dependencies

### Internal Dependencies
- `components/scrubber`: For data scrubbing and sanitization

### External Dependencies
- Kubernetes client libraries
- gRPC and related libraries
- Prometheus client
- OpenTelemetry
- Logrus for logging
- Various utility libraries

## Integration Points

The Common-Go component integrates with:
1. **All Go-based Gitpod Services**: Provides foundational functionality
2. **Kubernetes**: For cluster interaction and management
3. **Prometheus**: For metrics collection
4. **Tracing Systems**: For distributed tracing
5. **Logging Systems**: For centralized logging

## Usage Patterns

### Server Initialization
```go
srv, err := baseserver.New("service-name",
    baseserver.WithVersion(version),
    baseserver.WithConfig(cfg.Server),
)
if err != nil {
    log.WithError(err).Fatal("failed to initialize server")
}
```

### Logging
```go
log.WithFields(log.Fields{
    "user": userID,
    "workspace": workspaceID,
}).Info("workspace started")
```

### Tracing
```go
span, ctx := tracing.FromContext(ctx, "operation-name")
defer span.Finish()
span.SetTag("key", "value")
```

### Metrics
```go
counter := prometheus.NewCounter(prometheus.CounterOpts{
    Name: "operation_total",
    Help: "Total number of operations performed",
})
metrics.Registry.MustRegister(counter)
counter.Inc()
```

## Common Usage Patterns

The Common-Go component is typically used to:
1. Initialize and configure services
2. Set up logging, metrics, and tracing
3. Interact with Kubernetes
4. Implement gRPC servers and clients
5. Handle cross-cutting concerns like authentication and rate limiting
6. Manage feature flags and experiments
7. Track analytics events

## Related Components

- **All Go-based Services**: Use the Common-Go component for foundational functionality
- **Kubernetes Components**: Interact with Kubernetes using utilities from Common-Go
- **Monitoring Components**: Use metrics and tracing from Common-Go
