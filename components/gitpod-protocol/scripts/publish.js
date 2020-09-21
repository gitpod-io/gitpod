
/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// @ts-check

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const qualifier = process.argv[2];

const rootDir = process.cwd();
const pckDir = path.join(rootDir, "components-gitpod-protocol--lib/package");

if (process.env.NPM_AUTH_TOKEN) {
    fs.writeFileSync(path.join(pckDir, '.npmrc'), `//registry.npmjs.org/:_authToken=${process.env.NPM_AUTH_TOKEN}\n`, 'utf-8');
} else {
    console.warn('NPM_AUTH_TOKEN env variable is not set');
}

const pck = JSON.parse(fs.readFileSync(path.join(pckDir, 'package.json'), 'utf-8'));

const tag = qualifier.substr(0, qualifier.lastIndexOf('.'));

child_process.execSync([
    "yarn",
    "--cwd",
    pckDir,
    "publish",
    "--new-version",
    `${pck.version}-${qualifier}`,
    "--tag",
    tag,
    "--access",
    "public",
    "--ignore-scripts"
].join(" "), { stdio: 'inherit' });


