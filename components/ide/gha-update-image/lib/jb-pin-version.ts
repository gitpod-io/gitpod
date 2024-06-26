// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import {
    getLatestInstallerVersions,
    pathToConfigmap,
    readIDEConfigmapJson,
    readWorkspaceYaml,
    IWorkspaceYaml,
    getIDEVersionOfImage,
    renderInstallerIDEConfigMap,
} from "./common";

const configmap = await readIDEConfigmapJson().then((d) => d.rawObj);

const getIDEVersion = function (workspaceYaml: IWorkspaceYaml, ide: string) {
    const url = workspaceYaml.defaultArgs[`${ide}DownloadUrl` as keyof typeof workspaceYaml.defaultArgs];
    const str = url.split("-");
    if (str.length < 2) {
        return undefined;
    }

    return str.at(-1)!.replace(".tar.gz", "");
};

export const appendPinVersionsIntoIDEConfigMap = async (updatedIDEs: string[] | undefined) => {
    const latestInstallerVersions = await getLatestInstallerVersions();
    const workspaceYaml = await readWorkspaceYaml().then((d) => d.parsedObj);

    for (const [ide, versionObject] of Object.entries(latestInstallerVersions.components.workspace.desktopIdeImages)) {
        if (
            ide.includes("Latest") ||
            ["codeDesktop", "codeDesktopInsiders", "jbLauncher", "jbBackendPlugin", "jbBackendPluginLatest"].includes(
                ide,
            )
        ) {
            // Filter all non-IDE and non-jetbrains entries
            continue;
        }

        const ideVersion = getIDEVersion(workspaceYaml, ide);

        console.debug(`Processing ${ide} ${ideVersion}...`);

        const ideConfigMap = await renderInstallerIDEConfigMap(undefined)

        if (Object.keys(configmap.ideOptions.options).includes(ide)) {
            const { version: installerImageVersion } = versionObject;

            const previousVersion = await getIDEVersionOfImage(ideConfigMap.ideOptions.options[ide].image);
            const previousInfo = {
                version: previousVersion,
                image: ideConfigMap.ideOptions.options[ide].image.replaceAll("eu.gcr.io/gitpod-core-dev/build", "{{.Repository}}"),
                imageLayers: ideConfigMap.ideOptions.options[ide].imageLayers.map((e: string) => e.replaceAll("eu.gcr.io/gitpod-core-dev/build", "{{.Repository}}")),
            };

            if (!updatedIDEs || !updatedIDEs.includes(ide)) {
                console.log(`Ignore latest version (${ide}:${installerImageVersion})`);
                continue;
            }
            if (!configmap.ideOptions.options[ide].versions) {
                configmap.ideOptions.options[ide].versions = []
            }
            console.log(`Added ${ide} (new ${previousInfo.image})`);
            configmap.ideOptions.options[ide].versions.unshift(previousInfo);
        }
    }

    await Bun.write(pathToConfigmap, JSON.stringify(configmap, null, 2) + "\n");
    console.log(`File updated: ${pathToConfigmap}`);
};
