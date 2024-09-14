// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Update JetBrains Plugins (gateway / backend) Platform Version
//
// ```
// bun run index-jb-platform-update.ts --task=<id>
// ```

import { getTaskFromArgs } from "./lib/jb-helper/jb-gradle-task-config";
import {
    parseGradleProperties,
    renderPropertiesTemplate,
    parseGradlePropertiesFromTaskConfig,
} from "./lib/jb-helper/jb-helper";
import { fetchProductReleases } from "./lib/jb-helper/jb-releases";

const task = getTaskFromArgs(false);

console.log("Updating", task.taskName);

const releases = await fetchProductReleases(task);
const newProps = parseGradlePropertiesFromTaskConfig(task, releases[0]);
console.log("New properties info:", newProps);
const oldProps = parseGradleProperties(await Bun.file(task.gradlePropertiesPath).text());
console.log("Old properties info:", oldProps);

if (newProps.platformVersion === oldProps.platformVersion) {
    console.warn("PlatformVersion are the same, no need to update platform version");
    process.exit(0);
}

const newGradleContent = renderPropertiesTemplate("gha-update-image/index-jb-platform-update.ts", task, newProps);

await Bun.write(task.gradlePropertiesPath, newGradleContent);

console.log("Updated platform version to:", newProps.platformVersion);
