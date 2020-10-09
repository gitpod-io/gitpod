/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// @ts-check

const os = require('os');
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../lib/index.html');
fs.writeFileSync(filePath, fs.readFileSync(filePath, { encoding: 'utf-8' }).replace('<script', [
    '<meta id="gitpod-ide-capabilities" data-settings="' + JSON.stringify({ service: true }).replace(/"/g, '&quot;') + '">',
    '<script type="text/javascript"  src="/_supervisor/frontend/main.js"  charset="utf-8"></script>',
    '<script'
].join(os.EOL + '  ')), { encoding: 'utf-8' });