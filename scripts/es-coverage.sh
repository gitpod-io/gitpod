#!/bin/bash

export COVERAGE=true

yarn --cwd=/workspace/gitpod install
rm -rf coverage

# gitpod-protocol
rm -rf /workspace/gitpod/components/gitpod-protocol/coverage
yarn --cwd=/workspace/gitpod/components/gitpod-protocol run test:leeway
yarn nyc merge --cwd=/workspace/gitpod components/gitpod-protocol/coverage/unit coverage/gitpod-protocol-unit.json

# gitpod-db
rm -rf /workspace/gitpod/components/gitpod-db/coverage
yarn --cwd=/workspace/gitpod/components/gitpod-db run test:leeway
yarn nyc merge --cwd=/workspace/gitpod components/gitpod-db/coverage/db coverage/gitpod-db-db.json

# public-api-common
rm -rf /workspace/gitpod/components/public-api/typescript-common/coverage
yarn --cwd=/workspace/gitpod/components/public-api/typescript-common run test:leeway
yarn nyc merge --cwd=/workspace/gitpod components/public-api/typescript-common/coverage/unit coverage/public-api-common-unit.json

# server
rm -rf /workspace/gitpod/components/server/coverage
yarn --cwd=/workspace/gitpod/components/server run build
yarn --cwd=/workspace/gitpod/components/server run test
yarn nyc merge --cwd=/workspace/gitpod components/server/coverage/unit coverage/server-unit.json
yarn nyc merge --cwd=/workspace/gitpod components/server/coverage/db coverage/server-db.json

# ws-manager-api
rm -rf /workspace/gitpod/components/ws-manager-api/typescript/coverage
yarn --cwd=/workspace/gitpod/components/ws-manager-api/typescript run test:leeway
yarn nyc merge --cwd=/workspace/gitpod components/ws-manager-api/typescript/coverage/unit coverage/ws-manager-api-unit.json

# ws-manager-bridge
rm -rf /workspace/gitpod/components/ws-manager-bridge/coverage
yarn --cwd=/workspace/gitpod/components/ws-manager-bridge run test:leeway
yarn nyc merge --cwd=/workspace/gitpod components/ws-manager-bridge/coverage/unit coverage/ws-manager-bridge-unit.json

# final
yarn nyc merge --cwd=/workspace/gitpod coverage coverage/final-coverage.json
yarn nyc report --cwd=/workspace/gitpod --reporter=lcov --reporter=text-summary --temp-dir=coverage
