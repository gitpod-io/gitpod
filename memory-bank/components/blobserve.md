# Blobserve Component

## Overview

Blobserve is a service that provides static assets from OCI (Open Container Initiative) images. It serves as a specialized content delivery mechanism for container images, allowing efficient access to static content within those images.

## Purpose

The primary purpose of Blobserve is to:
- Extract and serve static content from container images
- Provide efficient access to image layers
- Handle authentication with container registries
- Serve HTTP requests for blob content

## Architecture

Blobserve operates as an HTTP server that:
1. Connects to container registries
2. Retrieves image content
3. Extracts and caches static assets
4. Serves these assets via HTTP

## Key Files and Structure

- `main.go`: Entry point that calls the Execute function from the cmd package
- `cmd/root.go`: Defines the root command and basic service configuration
- `cmd/run.go`: Implements the main server functionality
- `pkg/blobserve`: Contains the core implementation of the blob serving functionality

## Dependencies

### Internal Dependencies
- `components/common-go:lib`: Common Go utilities used across Gitpod
- `components/registry-facade-api/go:lib`: API definitions for registry facade
- `components/registry-facade:lib`: Library for interacting with container registries

### External Dependencies
- `containerd/containerd`: For container image handling
- `docker/cli`: For Docker configuration handling
- `prometheus`: For metrics and monitoring
- `spf13/cobra`: For command-line interface

## Configuration

Blobserve is configured via a JSON configuration file that includes:
- Authentication configuration for container registries
- HTTP server settings
- Repository mappings
- Caching parameters
- Monitoring endpoints

## Integration Points

Blobserve integrates with:
1. **Container Registries**: Connects to registries like Docker Hub, ECR, GCR
2. **Prometheus**: Exposes metrics for monitoring
3. **Health Checking**: Provides readiness probes for Kubernetes

## Security Considerations

- Requires proper IAM permissions when using cloud-based container registries (e.g., AWS ECR)
- Handles authentication credentials for private registries
- Monitors file changes for authentication configuration updates

## Common Usage Patterns

Blobserve is typically used to:
1. Serve static content from workspace images
2. Provide efficient access to container image layers
3. Cache frequently accessed content for performance

## Metrics and Monitoring

Blobserve exposes several Prometheus metrics:
- `http_client_requests_total`: Counter of outgoing HTTP requests
- `http_client_requests_duration_seconds`: Histogram of outgoing HTTP request durations
- `http_server_requests_total`: Counter of incoming HTTP requests
- `http_server_requests_duration_seconds`: Histogram of incoming HTTP request durations

## Known Limitations

- Requires specific IAM permissions when using cloud-based container registries
- Authentication configuration must be properly set up for private registries

## Related Components

- **Registry Facade**: Works closely with Blobserve to provide access to container images
- **Workspace Manager**: May use Blobserve to access workspace image content
