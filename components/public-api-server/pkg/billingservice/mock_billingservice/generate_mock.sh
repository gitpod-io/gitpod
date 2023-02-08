#!/bin/bash
SOURCE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)

mockgen -source="$SOURCE_DIR/../client.go" > ./billingservice.go
