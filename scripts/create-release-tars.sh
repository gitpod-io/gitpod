#!/bin/bash
set -euo pipefail

VERSION=${1:-""}
if [[ "$VERSION" == "" ]]; then
    echo "exit 1: expecting \"version\" as first and only argument, got nothing."
    exit -1;
fi
DIR=$(mktemp -d)

tar czf "$DIR/gitpod-helm-${VERSION}.tar.gz" -C chart .
tar czf "$DIR/gitpod-database-init-${VERSION}.tar.gz" -C chart/config/db/init $(cd chart/config/db/init && find . -name "*.sql" -and -not -name "00-testdb-user.sql")
tar czf "$DIR/gitpod-terraform-${VERSION}.tar.gz" -C install aws-terraform gcp-terraform

echo $DIR