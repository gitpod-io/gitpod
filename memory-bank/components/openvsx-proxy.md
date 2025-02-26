# OpenVSX-Proxy Component

## Overview

The OpenVSX-Proxy component in Gitpod is a caching proxy service for the OpenVSX registry, which is a repository for VS Code extensions. It stores frequently used requests to the OpenVSX registry and serves these cached responses when needed, particularly when the upstream registry is unavailable. This ensures that VS Code extensions remain accessible to Gitpod workspaces even during OpenVSX outages, improving the reliability and resilience of the IDE experience.

## Purpose

The primary purposes of the OpenVSX-Proxy component are:
- Cache responses from the OpenVSX registry to improve performance
- Provide fallback access to VS Code extensions when the upstream registry is down
- Reduce load on the upstream OpenVSX registry
- Improve reliability of VS Code extension availability in workspaces
- Minimize latency for frequently requested extensions
- Support the IDE experience by ensuring extension availability
- Provide metrics and monitoring for extension usage
- Handle cross-origin requests appropriately
- Support both in-memory and Redis-based caching strategies

## Architecture

The OpenVSX-Proxy component consists of several key parts:

1. **Reverse Proxy**: Forwards requests to the upstream OpenVSX registry
2. **Caching Layer**: Stores responses from the registry for future use
3. **Cache Management**: Handles cache expiration and validation
4. **Metrics Collection**: Tracks cache hits, misses, and request durations
5. **Error Handling**: Manages failures and provides fallback responses
6. **Configuration**: Configures caching behavior and upstream registry

The component operates as an HTTP server that intercepts requests for VS Code extensions, checks its cache for a valid response, and either serves the cached response or forwards the request to the upstream registry.

## Key Features

### Caching

- **Two-Tier Caching**: Implements regular (short-lived) and backup (long-lived) caching
- **Redis Support**: Optional Redis-based caching for distributed deployments
- **In-Memory Fallback**: Uses BigCache for in-memory caching when Redis is not available
- **Cache Validation**: Validates cached responses based on age and headers
- **Selective Caching**: Configurable domain allowlist for caching
- **Cache Expiration**: Configurable expiration times for different cache tiers

### Proxy Functionality

- **Transparent Proxying**: Acts as a reverse proxy to the upstream OpenVSX registry
- **Header Management**: Preserves and modifies headers as needed
- **CORS Support**: Handles cross-origin requests appropriately
- **Error Handling**: Provides fallback responses when upstream is unavailable
- **Connection Pooling**: Configurable connection pooling for upstream requests
- **Experiment Support**: Integration with Gitpod's experiment framework for A/B testing

### Monitoring and Metrics

- **Prometheus Integration**: Exposes metrics for monitoring
- **Request Duration Tracking**: Measures and reports request processing times
- **Cache Hit/Miss Metrics**: Tracks cache effectiveness
- **Health Endpoint**: Provides a status endpoint for health checks
- **Detailed Logging**: Comprehensive logging for debugging and monitoring

## Configuration

The OpenVSX-Proxy component is configured through a JSON configuration file:

```json
{
  "log_debug": false,
  "cache_duration_regular": "1h",
  "cache_duration_backup": "168h",
  "url_upstream": "https://open-vsx.org",
  "max_idle_conns": 100,
  "max_idle_conns_per_host": 10,
  "redis_addr": "redis:6379",
  "prometheusAddr": ":9500",
  "allow_cache_domain": ["open-vsx.org"]
}
```

### Configuration Options
- `log_debug`: Enables debug logging
- `cache_duration_regular`: Duration for the regular cache tier (e.g., "1h" for 1 hour)
- `cache_duration_backup`: Duration for the backup cache tier (e.g., "168h" for 1 week)
- `url_upstream`: URL of the upstream OpenVSX registry
- `max_idle_conns`: Maximum number of idle connections
- `max_idle_conns_per_host`: Maximum number of idle connections per host
- `redis_addr`: Address of the Redis server (if using Redis for caching)
- `prometheusAddr`: Address for exposing Prometheus metrics
- `allow_cache_domain`: List of domains for which caching is allowed

## Integration Points

The OpenVSX-Proxy component integrates with:
1. **OpenVSX Registry**: The upstream source of VS Code extensions
2. **VS Code/Theia**: The IDE that requests extensions through the proxy
3. **Redis**: Optional caching backend for distributed deployments
4. **Prometheus**: For metrics collection and monitoring
5. **Gitpod Experiment Framework**: For A/B testing and feature flags

## Usage Patterns

### Extension Request Flow
1. VS Code/Theia requests an extension from the proxy
2. Proxy checks its cache for a valid response
3. If a valid cached response exists, it is returned immediately
4. If no valid cache exists, the request is forwarded to the upstream registry
5. The response from the upstream is cached and returned to the client
6. If the upstream is unavailable, the backup cache is used if available

### Cache Tiers
- **Regular Cache**: Used for frequently accessed extensions, with a shorter TTL
- **Backup Cache**: Used when the upstream is unavailable, with a longer TTL

## Dependencies

### Internal Dependencies
- `components/common-go`: Common Go utilities

### External Dependencies
- `github.com/eko/gocache`: Caching library
- `github.com/allegro/bigcache`: In-memory cache implementation
- `github.com/go-redis/redis`: Redis client
- `github.com/sirupsen/logrus`: Logging library
- `github.com/google/uuid`: UUID generation
- `github.com/go-ozzo/ozzo-validation`: Configuration validation

## Security Considerations

The component implements several security measures:

1. **No Credential Forwarding**: Does not forward authentication credentials to the upstream
2. **Header Sanitization**: Sanitizes headers to prevent security issues
3. **CORS Handling**: Properly handles cross-origin requests
4. **Input Validation**: Validates configuration and inputs
5. **Error Handling**: Prevents leaking sensitive information in error responses

## Implementation Details

### Caching Strategy

The proxy implements a two-tier caching strategy:
1. **Regular Cache**: Responses are cached for a short period (configurable, typically hours)
2. **Backup Cache**: All responses are stored in a longer-term cache (configurable, typically days or weeks)

When a request is received:
- If a valid regular cache entry exists, it is served immediately
- If no valid regular cache exists but the request is cacheable, it is forwarded to the upstream
- If the upstream is unavailable and a backup cache entry exists, the backup is served
- All successful responses from the upstream are stored in both cache tiers

### Request Handling

The request handling flow:
1. Generate a unique request ID
2. Determine the upstream URL (potentially using experiment framework)
3. Check if caching is allowed for the domain
4. Generate a cache key based on the request
5. Check the cache for a valid entry
6. If a valid entry exists and is within the regular cache TTL, serve it
7. Otherwise, forward the request to the upstream
8. Store the response in the cache
9. Return the response to the client

## Related Components

- **IDE Service**: Uses the OpenVSX-Proxy to provide extensions to workspaces
- **IDE**: Requests extensions through the proxy
- **Supervisor**: May interact with the proxy for workspace setup
