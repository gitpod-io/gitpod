#!/bin/bash

# This script installs the Git MCP server and registers it for use with the cline VSCode extension: https://github.com/cline/cline
#
# Usage:
#   ./register-cline.sh <repository-path> [write-access] [mode]
#
# Parameters:
#   repository-path: Required. Path to a Git repository to use.
#   write-access: Optional. Set to "true" to enable write operations. Default is "false".
#   mode: Optional. Git operation mode: 'shell' or 'go-git'. Default is "shell".
#
# Examples:
#   ./register-cline.sh ~/my-repo                    # Install with read-only mode (default)
#   ./register-cline.sh ~/my-repo true               # Install with write operations enabled
#   ./register-cline.sh ~/my-repo false go-git       # Specify mode

# Get parameters with defaults
REPO_PATH=$1
WRITE_ACCESS=${2:-false}
MODE=${3:-shell}

# Check for required tools
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq first."
    exit 1
fi

MCP_SERVERS_DIR="$HOME/mcp-servers"
mkdir -p "$MCP_SERVERS_DIR"

# Check if the Git MCP server binary is on the path already
GIT_MCP_BINARY="$(which git-mcp-go)"
if [ -z "$GIT_MCP_BINARY" ]; then
    echo "Did not find git-mcp-go on the path, installing from latest GitHub release..."

    # This fetches information about the latest release to determine the download URL
    LATEST_RELEASE=$(curl -s https://api.github.com/repos/geropl/git-mcp-go/releases/latest)

    # Determine platform for download
    PLATFORM="linux"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        PLATFORM="darwin"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        PLATFORM="windows"
    fi

    # Extract the download URL for the appropriate binary
    DOWNLOAD_URL=$(echo "$LATEST_RELEASE" | jq -r ".assets[] | select(.name | contains(\"$PLATFORM\")) | .browser_download_url")

    if [ -z "$DOWNLOAD_URL" ]; then
        echo "Error: Could not find appropriate binary in the latest release"
        exit 1
    fi

    # Download the Git MCP server binary
    echo "Downloading Git MCP server from $DOWNLOAD_URL..."
    curl -L -o "$MCP_SERVERS_DIR/git-mcp-go" "$DOWNLOAD_URL"

    # Make the binary executable
    chmod +x "$MCP_SERVERS_DIR/git-mcp-go"

    echo "Git MCP server installed successfully at $MCP_SERVERS_DIR/git-mcp-go"
    GIT_MCP_BINARY="$MCP_SERVERS_DIR/git-mcp-go"
fi

# Configure cline to use the MCP server
# This is where Cline looks for MCP server configurations
CLINE_CONFIG_DIR="$HOME/.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/settings"
mkdir -p "$CLINE_CONFIG_DIR"

CLINE_MCP_SETTINGS="$CLINE_CONFIG_DIR/cline_mcp_settings.json"

# Build the args array based on parameters
SERVER_ARGS="["

# Add repository path if provided
if [ -n "$REPO_PATH" ]; then
  # Expand the path to absolute path
  REPO_PATH=$(realpath "$REPO_PATH")
  SERVER_ARGS="$SERVER_ARGS\"--repository=$REPO_PATH\""
fi

# Add write-access flag if enabled
if [ "$WRITE_ACCESS" = "true" ]; then
  if [ -n "$SERVER_ARGS" ] && [ "$SERVER_ARGS" != "[" ]; then
    SERVER_ARGS="$SERVER_ARGS, "
  fi
  SERVER_ARGS="$SERVER_ARGS\"--write-access=true\""
fi

# Add mode if not the default
if [ -n "$MODE" ]; then
  if [ -n "$SERVER_ARGS" ] && [ "$SERVER_ARGS" != "[" ]; then
    SERVER_ARGS="$SERVER_ARGS, "
  fi
  SERVER_ARGS="$SERVER_ARGS\"--mode=$MODE\""
fi

SERVER_ARGS="$SERVER_ARGS]"

# Merge the existing settings with the new MCP server configuration
cat <<EOF > "$CLINE_MCP_SETTINGS.new"
{
  "mcpServers": {
    "git": {
      "command": "$GIT_MCP_BINARY",
      "args": $SERVER_ARGS,
      "disabled": false,
      "autoApprove": []
    }
  }
}
EOF

if [ -f "$CLINE_MCP_SETTINGS" ]; then
    echo "Found existing Cline MCP settings at $CLINE_MCP_SETTINGS"
    echo "Merging with new MCP server configuration..."
    jq -s '.[0] * .[1]' "$CLINE_MCP_SETTINGS" "$CLINE_MCP_SETTINGS.new" > "$CLINE_MCP_SETTINGS.tmp"
    mv "$CLINE_MCP_SETTINGS.tmp" "$CLINE_MCP_SETTINGS"
else
    echo "Creating new Cline MCP settings at $CLINE_MCP_SETTINGS"
    mv "$CLINE_MCP_SETTINGS.new" "$CLINE_MCP_SETTINGS"
fi
rm -f "$CLINE_MCP_SETTINGS.new"

echo "Cline MCP settings updated at $CLINE_MCP_SETTINGS"
echo "Git MCP server has been registered with the following configuration:"
echo "  - Write Access: $WRITE_ACCESS"
if [ -n "$REPO_PATH" ]; then
  echo "  - Repository Path: $REPO_PATH"
fi
echo "  - Mode: $MODE"
