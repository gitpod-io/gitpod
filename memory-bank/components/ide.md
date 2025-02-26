# IDE Component

## Overview

The IDE component in Gitpod is responsible for packaging and managing the various Integrated Development Environments (IDEs) that are available to users within Gitpod workspaces. It includes support for VS Code (both web and desktop versions) and JetBrains IDEs, providing the necessary files, configurations, and integration points for these IDEs to work seamlessly within the Gitpod environment.

## Purpose

The primary purposes of the IDE component are:
- Package and distribute IDE binaries for use in Gitpod workspaces
- Configure IDEs to work within the Gitpod environment
- Provide integration between IDEs and the Gitpod platform
- Support multiple IDE types (VS Code, JetBrains)
- Enable both web-based and desktop IDE experiences
- Manage IDE versions and updates
- Provide IDE-specific extensions and plugins

## Architecture

The IDE component is organized into several sub-components, each responsible for a specific IDE or IDE family:

1. **Code**: Packages VS Code (OpenVSCode Server) for web-based usage
2. **Code-Desktop**: Packages VS Code for desktop usage
3. **JetBrains**: Packages various JetBrains IDEs (IntelliJ, GoLand, PyCharm, etc.)
4. **Xterm**: Provides terminal functionality

Each IDE sub-component typically includes:
- Dockerfiles for building IDE images
- Configuration files for IDE integration
- Scripts for downloading and setting up IDE binaries
- Plugins or extensions for Gitpod integration

## Key Files and Structure

### VS Code (Code)
- `code/BUILD.yaml`: Build configuration for VS Code
- `code/leeway.Dockerfile`: Dockerfile for building VS Code image
- `code/codehelper/`: Helper utilities for VS Code
- `code/gitpod-web-extension/`: Gitpod-specific VS Code extension

### JetBrains
- `jetbrains/image/`: JetBrains IDE image building
- `jetbrains/image/BUILD.js`: Build script for JetBrains IDE images
- `jetbrains/image/leeway.Dockerfile`: Dockerfile for JetBrains IDE images
- `jetbrains/image/supervisor-ide-config_*.json`: IDE-specific configuration files
- `jetbrains/backend-plugin/`: Backend plugin for JetBrains IDEs
- `jetbrains/gateway-plugin/`: Gateway plugin for JetBrains remote development
- `jetbrains/launcher/`: Launcher for JetBrains IDEs
- `jetbrains/cli/`: Command-line interface for JetBrains IDEs

## Supported IDEs

### VS Code
- Web-based VS Code (OpenVSCode Server)
- Desktop VS Code

### JetBrains
- IntelliJ IDEA
- GoLand
- PyCharm
- PhpStorm
- RubyMine
- WebStorm
- Rider
- CLion
- RustRover

Each JetBrains IDE is available in two versions:
- Stable: Regular release version
- Latest: Latest EAP (Early Access Program) or RC (Release Candidate) version

## Build Process

### VS Code
1. Clones the OpenVSCode Server repository
2. Builds the web and desktop versions
3. Packages the built binaries into a Docker image
4. Configures the image for use with Gitpod

### JetBrains
1. Downloads the specified JetBrains IDE binary
2. Creates a Docker image with the IDE binary
3. Configures the IDE for use with Gitpod
4. Sets up the necessary plugins and extensions

## Integration Points

The IDE component integrates with:
1. **Supervisor**: For launching and managing IDEs within workspaces
2. **Workspace**: For accessing workspace content
3. **IDE Service**: For resolving IDE requirements
4. **Blobserve**: For serving static IDE assets
5. **Registry Facade**: For providing IDE images

## Configuration

Each IDE has specific configuration requirements:

### VS Code
- Extensions to be pre-installed
- Web configuration for browser-based usage
- Desktop configuration for desktop usage

### JetBrains
- IDE-specific configuration files
- Backend plugin configuration
- Gateway plugin configuration
- CLI configuration

## Dependencies

### Internal Dependencies
- `supervisor`: For IDE lifecycle management
- `ide-service`: For IDE resolution
- `blobserve`: For serving static assets
- `registry-facade`: For image management

### External Dependencies
- VS Code (OpenVSCode Server) source code
- JetBrains IDE binaries
- Various build tools (Node.js, npm, etc.)

## Common Usage Patterns

The IDE component is typically used to:
1. Build and package IDE images for use in Gitpod workspaces
2. Configure IDEs for optimal use within Gitpod
3. Provide integration between IDEs and the Gitpod platform
4. Support both web-based and desktop IDE experiences
5. Manage IDE versions and updates

## Related Components

- **IDE Service**: Resolves IDE requirements and manages IDE configurations
- **IDE Proxy**: Proxies requests to IDEs
- **Supervisor**: Manages IDE lifecycle within workspaces
- **Blobserve**: Serves static IDE assets
- **Registry Facade**: Provides IDE images
