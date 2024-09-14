// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Update JetBrains latest editor images
//
// ```
// bun run index-jb-nightly.ts --task=<id> --productCode=<code>
// ```

import { $ } from "bun";
import { appendGitHubOutput, pathToBackendPluginGradleLatest, readWorkspaceYaml } from "./lib/common";
import { maybeCompatible, parseGradleProperties, parseGradlePropertiesFromTaskConfig } from "./lib/jb-helper/jb-helper";
import { fetchProductReleases, ReleaseItem, releaseItemStr } from "./lib/jb-helper/jb-releases";
import { getTaskFromArgs } from "./lib/jb-helper/jb-gradle-task-config";

$.nothrow(); // git likes to respond with non-zero codes, but it is alright for us

const task = getTaskFromArgs(true);

if (task.id !== 1) {
    throw new Error(`Only task 1 is supported, got ${task.id}`);
}

console.log(`Updating nightly editor for ${task.productId} (${task.productType})`);

const { parsedObj: parsedWorkspaceYaml } = await readWorkspaceYaml();

const downloadUrl = parsedWorkspaceYaml.defaultArgs[task.productId + "DownloadUrl"] as string;

const latestGradle = parseGradleProperties(await Bun.file(pathToBackendPluginGradleLatest).text());

const platformVersionType = "build";

const releases = await fetchProductReleases({ productCode: task.productCode, productType: task.productType });

let maybeCompatibleRelease: ReleaseItem | undefined;
for (const release of releases) {
    switch (platformVersionType) {
        case "build": {
            const ok = maybeCompatible(release, latestGradle);
            if (ok) {
                maybeCompatibleRelease = release;
                break;
            } else {
                console.error(`${releaseItemStr(release)} incompatible`);
            }
        }
    }
    if (maybeCompatibleRelease) {
        break;
    }
}

if (maybeCompatibleRelease) {
    console.log(`${releaseItemStr(maybeCompatibleRelease)} maybe compatible`);
}

const targetRelease = maybeCompatibleRelease || releases.find((e) => e.downloads.linux?.link === downloadUrl);

if (!targetRelease) {
    throw new Error(`No compatible release found`);
}

console.log(`Preparing to use ${releaseItemStr(targetRelease)} as latest version for ${task.productId}`);

const targetConfig = parseGradlePropertiesFromTaskConfig(task, targetRelease);

// TODO: actually update nightly editor
console.log(
    `Going to exec \`leeway build -Dversion=latest -DimageRepoBase=$imageRepoBase -DbuildNumber=${targetConfig.platformVersion} components/ide/jetbrains/image:${task.productId}-latest -DjbBackendVersion=${targetRelease.version}\``,
);

appendGitHubOutput(`buildNumber=${targetConfig.platformVersion}`);
appendGitHubOutput(`image=${task.productId}`);
appendGitHubOutput(`jbBackendVersion=${targetRelease.version}`);
appendGitHubOutput(`editorSummary=${releaseItemStr(targetRelease)}`);
