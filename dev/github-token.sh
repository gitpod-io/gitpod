#!/bin/bash

# GitHub Token Helper
# Dynamically retrieves GitHub token from git credentials
# Safe to source - will not error if git credentials are unavailable

# Only set GH_TOKEN if not already set and git credential is available
if [ -z "$GH_TOKEN" ] && command -v git >/dev/null 2>&1; then
    # Attempt to get token from git credentials, suppress errors
    TOKEN=$(printf 'protocol=https\nhost=github.com\n' | git credential fill 2>/dev/null | awk -F= '/password/ {print $2}' 2>/dev/null)
    
    # Only export if we got a non-empty token
    if [ -n "$TOKEN" ]; then
        export GH_TOKEN="$TOKEN"
    fi
    
    unset TOKEN
fi
