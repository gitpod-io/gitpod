/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

const semver = require('semver');
if (!semver.valid(process.argv[2])) {
    process.exit(1);
}
