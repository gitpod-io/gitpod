/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// @ts-check
'use strict';

const request = require('request');
const fs = require('fs');
const path = require('path');

const targetDir = "./public/libs"

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const urls = [
    "https://unpkg.com/react-dom@16.7.0/umd/react-dom.production.min.js",
    "https://unpkg.com/react@16.7.0/umd/react.production.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.21.0/moment.min.js",
];

for (const url of urls) {
    const fileName = new URL(url).pathname.split('/').pop();
    const file = fs.createWriteStream(path.resolve(targetDir, fileName));
    request(url)
        .pipe(file)
        .on("error", (error) => { console.error(error); process.exit(1) })
        .on('close', () => console.log(`✅ Downloaded: ${fileName}`));
}
