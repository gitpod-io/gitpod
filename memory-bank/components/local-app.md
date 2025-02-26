# Local App Component

## Overview

The Local App component in Gitpod provides tools for interacting with Gitpod workspaces from a user's local machine. It consists of two main applications: the Gitpod CLI (`gitpod-cli`) and the Local Companion App (`gitpod-local-companion`). These tools enable users to connect to their remote Gitpod workspaces, access ports, establish SSH connections, and manage workspaces from their local environment.

## Purpose

The primary purposes of the Local App component are:
- Provide a command-line interface for interacting with Gitpod
- Enable SSH access to Gitpod workspaces
- Establish secure tunnels to workspace ports
- Manage authentication and tokens for Gitpod access
- Support local development workflows with remote workspaces
- Enable port forwarding from workspaces to local machine
- Provide auto-updating capabilities for client tools
- Generate and manage SSH configurations

## Architecture

The Local App component consists of several key parts:

1. **Gitpod CLI**: A command-line tool for interacting with Gitpod
2. **Local Companion App**: A background service that maintains connections to workspaces
3. **Bastion**: Core functionality for establishing and managing tunnels
4. **Authentication**: Handles secure login and token management
5. **Self-update**: Manages automatic updates of the client tools

The component is designed to work across multiple platforms (Linux, macOS, Windows) and architectures (amd64, arm64).

## Key Files and Structure

- `main/gitpod-cli/main.go`: Entry point for the CLI application
- `main/gitpod-local-companion/main.go`: Entry point for the Local Companion App
- `pkg/bastion/bastion.go`: Core tunneling and connection management
- `pkg/auth/`: Authentication and token management
- `pkg/selfupdate/`: Self-update functionality
- `pkg/config/`: Configuration management
- `pkg/helper/`: Helper utilities
- `pkg/telemetry/`: Telemetry collection

## CLI Commands

The Gitpod CLI provides various commands for interacting with Gitpod:

- `gitpod login`: Authenticate with Gitpod
- `gitpod workspace`: Manage workspaces
- `gitpod ssh`: SSH into a workspace
- `gitpod port`: Forward ports from a workspace
- `gitpod context`: Manage Gitpod contexts (different Gitpod installations)
- `gitpod completion`: Generate shell completion scripts

## Local Companion App

The Local Companion App runs in the background and provides:

1. **Workspace Monitoring**: Tracks running workspaces
2. **Port Tunneling**: Automatically establishes tunnels to exposed ports
3. **SSH Access**: Sets up SSH access to workspaces
4. **API Endpoint**: Exposes a gRPC API for other tools to interact with

## Tunneling System

The tunneling system is a core feature that:

1. **Establishes SSH Connections**: Creates secure SSH connections to workspaces
2. **Forwards Ports**: Maps remote workspace ports to local ports
3. **Manages Visibility**: Handles port visibility settings (public, private)
4. **Monitors Port Status**: Tracks port status changes in workspaces
5. **Generates SSH Config**: Creates SSH configuration for easy access

## Authentication

The authentication system:

1. **Manages Tokens**: Securely stores and retrieves authentication tokens
2. **Handles Login Flow**: Implements the OAuth login flow
3. **Uses System Keyring**: Stores tokens in the system's secure keyring
4. **Validates Tokens**: Ensures tokens are valid before use

## Self-Update Mechanism

The component includes a self-update mechanism that:

1. **Checks for Updates**: Periodically checks for new versions
2. **Downloads Updates**: Retrieves new versions when available
3. **Installs Updates**: Replaces the current binary with the new version
4. **Maintains Versioning**: Uses semantic versioning for updates

## Dependencies

### Internal Dependencies
- `components/supervisor-api`: For communicating with workspace supervisor
- `components/gitpod-protocol`: For Gitpod API communication
- `components/local-app-api`: API definitions for the Local App
- `components/public-api`: Public API definitions

### External Dependencies
- SSH libraries for secure connections
- gRPC for API communication
- WebSockets for real-time communication
- System keyring for secure token storage

## Integration Points

The Local App component integrates with:
1. **Gitpod Server**: For authentication and workspace information
2. **Workspace Supervisor**: For port information and terminal access
3. **IDE Proxy**: For downloading client binaries
4. **Local System**: For SSH configuration and port forwarding

## Configuration

The Local App is configured through:

1. **Command-line Flags**: For immediate configuration
2. **Environment Variables**: For persistent configuration
3. **Configuration File**: Located at `~/.gitpod/config.yaml`
4. **SSH Configuration**: Generated at a configurable location

## Security Considerations

The Local App implements several security measures:

1. **Secure Token Storage**: Uses system keyring for token storage
2. **SSH Key Management**: Generates and manages SSH keys securely
3. **Owner Token Validation**: Ensures only workspace owners can connect
4. **Port Visibility Enforcement**: Respects port visibility settings

## Common Usage Patterns

The Local App component is typically used to:
1. Connect to running workspaces via SSH
2. Forward workspace ports to the local machine
3. Manage workspaces from the command line
4. Integrate Gitpod with local development tools
5. Access workspace services from local applications

## Related Components

- **Supervisor**: Provides workspace information and port status
- **IDE Proxy**: Serves client binaries and updates
- **Server**: Handles authentication and workspace management
- **Dashboard**: Provides web UI for workspace management
