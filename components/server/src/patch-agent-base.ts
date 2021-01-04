/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

const url = require('url');
const https = require('https');

// preserve originals
const originalRequestFn = https.request;
const originalGetFn = https.get;

// require the evil;
// we assume, as nodejs will cache it, it won't we evaluated/loaded a second time
// so we pre-emptively fix the things right afterwards.
require('agent-base');

https.request = originalRequestFn;
https.get = originalGetFn;

console.log("done patching the patch from `agent-base@4.2.1`");
