/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/**
 * @example node scripts/new-fixtures.js toPrebuildSettings 2
 */

const testName = process.argv[2];
const numOfFiles = process.argv[3];

const { writeFileSync } = require("node:fs");
const { join } = require("node:path");

for (let i = 0; i < numOfFiles; i++) {
    writeFileSync(join(__dirname, `../fixtures/${testName}_${i + 1}.json`), JSON.stringify({}));
}
