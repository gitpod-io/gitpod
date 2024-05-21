// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import { $ } from "bun";
import yaml from "yaml";
import { z } from "zod";
import { pathToConfigmap, pathToWorkspaceYaml } from "./common";

const versionManifest = z.object({
    components: z.object({
        workspace: z.object({
            desktopIdeImages: z.record(z.string(), z.object({ version: z.string() })),
        }),
    }),
});

const workspaceYaml = z.object({
    defaultArgs: z.object({
        intellijDownloadUrl: z.string(),
        golandDownloadUrl: z.string(),
        pycharmDownloadUrl: z.string(),
        phpstormDownloadUrl: z.string(),
        rubymineDownloadUrl: z.string(),
        webstormDownloadUrl: z.string(),
        riderDownloadUrl: z.string(),
        clionDownloadUrl: z.string(),
    }),
});

const configmap = JSON.parse(await Bun.file(pathToConfigmap).text());

let rawWorkspace = await Bun.file(pathToWorkspaceYaml).text();
const workspace = workspaceYaml.parse(yaml.parse(rawWorkspace));

const getIDEVersion = function (ide: string) {
    const url = workspace.defaultArgs[`${ide}DownloadUrl`];
    const str = url.split("-");
    if (str.length < 2) {
        return undefined;
    }

    return str.at(-1)!.replace(".tar.gz", "");
};

export const appendPinVersionsIntoIDEConfigMap = async () => {
    const tagInfo =
        await $`git ls-remote --tags --sort=-v:refname https://github.com/gitpod-io/gitpod | grep 'main-gha.' | head -n1`
            .text()
            .catch((e) => {
                throw new Error("Failed to fetch the latest main-gha. git tag", e);
            });
    const installationVersion =
        await $`echo ${tagInfo} | awk '{ print $2 }' | grep -o 'main-gha.[0-9]*' | cut -d'/' -f3`.text().catch((e) => {
            throw new Error("Failed to parse installer version from git tag", e);
        });
    const versionData =
        await $`docker run --rm eu.gcr.io/gitpod-core-dev/build/versions:${installationVersion.trim()} cat /versions.yaml`
            .text()
            .catch((e) => {
                throw new Error("Failed to fetch versions.yaml from latest installer", e);
            });

    const parsedVersions = versionManifest.safeParse(yaml.parse(versionData));
    if (!parsedVersions.success) {
        throw new Error("The versions.yaml file does not match the expected format", parsedVersions.error);
    }

    for (const [ide, versionObject] of Object.entries(parsedVersions.data.components.workspace.desktopIdeImages)) {
        if (
            ide.includes("Latest") ||
            ["codeDesktop", "codeDesktopInsiders", "jbLauncher", "jbBackendPlugin"].includes(ide)
        ) {
            // Filter all non-IDE and non-jetbrains entries
            continue;
        }

        const ideVersion = getIDEVersion(ide);

        console.debug(`Processing ${ide} ${ideVersion}...`);

        if (Object.keys(configmap.ideOptions.options).includes(ide)) {
            const { version: installerImageVersion } = versionObject;
            const configmapVersions = configmap.ideOptions.options[ide]?.versions ?? [];

            const installerIdeVersion = {
                version: ideVersion,
                image: `{{.Repository}}/ide/${ide}:${installerImageVersion}`,
                imageLayers: [
                    `{{.Repository}}/ide/jb-backend-plugin:${parsedVersions.data.components.workspace.desktopIdeImages.jbBackendPlugin.version}`,
                    `{{.Repository}}/ide/jb-launcher:${parsedVersions.data.components.workspace.desktopIdeImages.jbLauncher.version}`,
                ],
            };

            if (configmapVersions.length === 0) {
                console.log(
                    `${ide} does not have multiple versions support. Initializing it with the current installer version.`,
                );
                configmap.ideOptions.options[ide].versions = [installerIdeVersion];
                continue;
            }

            const currentVersion = configmapVersions.at(0);
            if (currentVersion.version === ideVersion) {
                // Update the current version
                configmap.ideOptions.options[ide].versions[0] = installerIdeVersion;
                console.log(`Updated ${ide} (old ${currentVersion.image}, new ${installerIdeVersion.image})`);
            } else {
                configmap.ideOptions.options[ide].versions.unshift(installerIdeVersion);
                console.log(`Added ${ide} (new ${installerIdeVersion.image})`);
            }
        }
    }

    await Bun.write(pathToConfigmap, JSON.stringify(configmap, null, 2) + "\n");
    console.log(`File updated: ${pathToConfigmap}`);
};
