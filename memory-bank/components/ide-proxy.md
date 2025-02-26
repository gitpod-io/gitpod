# IDE Proxy Component

## Overview

The IDE Proxy is a lightweight component in Gitpod that serves static assets related to IDEs, including IDE logos, binaries, and configuration files. It acts as a centralized service for delivering IDE-related static content to other components of the Gitpod platform, particularly the dashboard and workspaces.

## Purpose

The primary purposes of the IDE Proxy component are:
- Serve static IDE-related assets (logos, icons, etc.)
- Provide a centralized location for IDE binaries and downloads
- Serve the Gitpod Local Companion application binaries
- Proxy requests to the blobserve component for IDE-related content
- Provide metrics endpoints for IDE usage
- Implement proper caching and security headers for static content
- Serve VS Code marketplace extension information

## Architecture

The IDE Proxy is built on Caddy, a modern web server with automatic HTTPS capabilities. It consists of several key components:

1. **Static File Server**: Serves static files like IDE logos and binaries
2. **Proxy Rules**: Routes specific requests to other services like blobserve
3. **Security Headers**: Implements security policies for served content
4. **Caching Configuration**: Optimizes content delivery with appropriate caching
5. **Health Checks**: Provides endpoints for monitoring system health

## Key Files and Structure

- `Dockerfile`: Builds the IDE Proxy container image
- `conf/Caddyfile`: Main configuration file for the Caddy server
- `static/image/ide-logo/`: Contains SVG logos for various IDEs
- `static/bin/`: Contains binaries for Gitpod Local Companion (added during build)
- `static/code/`: Contains VS Code marketplace information (added during build)

## Static Assets

### IDE Logos
The component serves SVG logos for various IDEs:
- VS Code (standard and Insiders)
- JetBrains IDEs:
  - IntelliJ IDEA
  - GoLand
  - PyCharm
  - PhpStorm
  - RubyMine
  - WebStorm
  - Rider
  - CLion
  - RustRover
- Terminal

### Binaries
The component serves binaries for:
- Gitpod Local Companion for various platforms:
  - Linux (x86_64)
  - macOS (x86_64)
  - Windows (x86_64)

## Routing Rules

The IDE Proxy implements several routing rules:

1. **Static Content**: Serves files from the `/www` directory with appropriate headers
2. **Blobserve Proxy**: Routes `/blobserve/*` requests to the blobserve service
3. **Binary Assets**: Serves binary files with appropriate content-type and disposition headers
4. **Metrics**: Routes metrics-related requests to the ide-metrics service
5. **Health Checks**: Provides `/live` and `/ready` endpoints for health monitoring

## Configuration

The IDE Proxy is configured through the Caddyfile, which includes:

### Security Headers
- HTTP Strict Transport Security (HSTS)
- Content-Type Options
- Content Security Policy
- Referrer Policy
- XSS Protection

### Caching Configuration
- Long-term caching for static assets (1 year)
- Short-term caching for binary assets (10 minutes)

### Compression
- Supports gzip and zstd compression for efficient content delivery

## Dependencies

### Internal Dependencies
- `blobserve`: For serving IDE-related blob content
- `ide-metrics`: For metrics collection
- `local-app`: For Gitpod Local Companion binaries

### External Dependencies
- Caddy web server
- OpenVSX marketplace data

## Integration Points

The IDE Proxy integrates with:
1. **Dashboard**: Provides IDE logos and information for the UI
2. **Blobserve**: Proxies requests to blobserve for IDE content
3. **IDE Metrics**: Routes metrics requests to the metrics service
4. **Local App**: Serves the Gitpod Local Companion binaries

## Security Considerations

- Implements comprehensive security headers
- Ensures proper content-type for binary downloads
- Configures appropriate CORS headers for cross-origin requests
- Removes server identification headers

## Common Usage Patterns

The IDE Proxy is typically used to:
1. Serve IDE logos for the dashboard UI
2. Provide downloadable binaries for Gitpod Local Companion
3. Proxy requests to blobserve for IDE-related content
4. Serve VS Code marketplace extension information
5. Collect and expose IDE usage metrics

## Related Components

- **IDE**: Provides the IDE binaries and assets
- **IDE Service**: Resolves IDE requirements
- **Blobserve**: Serves blob content that may be proxied through IDE Proxy
- **Dashboard**: Consumes IDE logos and information
- **IDE Metrics**: Collects and processes IDE usage metrics
