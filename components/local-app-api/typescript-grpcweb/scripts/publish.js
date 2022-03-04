
/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// @ts-check

const fs = require('fs');
const path = require('path');

const supervisorPckPath = path.join(process.cwd(), 'components-supervisor-api-typescript-grpcweb--publish/components-supervisor-api-typescript-grpcweb--lib/package');
const localAppPckPath = path.join(process.cwd(), 'components-local-app-api-typescript-grpcweb--lib/package');

const supervisorPck = JSON.parse(fs.readFileSync(path.join(supervisorPckPath, 'package.json'), 'utf-8'));
const localAppPck = JSON.parse(fs.readFileSync(path.join(localAppPckPath, 'package.json'), 'utf-8'));
localAppPck.dependencies['@gitpod/supervisor-api-grpcweb'] = supervisorPck.version;
fs.writeFileSync(path.join(localAppPckPath, 'package.json'), JSON.stringify(localAppPck, undefined, 2), 'utf-8');

process.argv.push('components-local-app-api-typescript-grpcweb--lib/package');
require(path.join(process.cwd(), 'components-local-app-api-typescript-grpcweb--scripts/components-gitpod-protocol--scripts/publish.js'));