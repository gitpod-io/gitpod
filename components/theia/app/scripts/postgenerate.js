/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// @ts-check

const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../lib/index.html');
fs.writeFileSync(filePath, `<!DOCTYPE html>
<html lang="en">

<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="apple-mobile-web-app-capable" content="yes">
    <meta id="gitpod-ide-capabilities" data-settings="{&quot;service&quot;:true}">
</head>

<body>
	<script type="text/javascript" src="./_supervisor/frontend/main.js" charset="utf-8"></script>
	<div class="theia-preload"></div>
	<script type="text/javascript" src="./bundle.js" charset="utf-8"></script>
</body>

</html>`, { encoding: 'utf-8' });