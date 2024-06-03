// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import { $ } from "bun";
import { upgradeStableVersionsInWorkspaceaAndGradle } from "./lib/jb-stable-version";
import { appendPinVersionsIntoIDEConfigMap } from "./lib/jb-pin-version";

$.nothrow(); // git likes to respond with non-zero codes, but it is alright for us

await upgradeStableVersionsInWorkspaceaAndGradle();
await appendPinVersionsIntoIDEConfigMap();
