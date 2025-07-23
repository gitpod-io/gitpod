#!/bin/bash

# GitHub CLI Authentication Setup
# Adds sourcing of GitHub token helper to shell profiles

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GITHUB_TOKEN_HELPER="$SCRIPT_DIR/github-token.sh"

{
    echo ""
    echo "# GitHub token helper"
    echo "source \"$GITHUB_TOKEN_HELPER\""
} >> ~/.bashrc

{
    echo ""
    echo "# GitHub token helper"
    echo "source \"$GITHUB_TOKEN_HELPER\""
} >> ~/.zshrc

source "$GITHUB_TOKEN_HELPER"

echo "✅ GitHub CLI configured"
