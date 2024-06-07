// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import { $ } from "bun";
import {
    getLatestInstallerVersions,
    pathToConfigmap,
    pathToOutput,
    readIDEConfigmapJson,
    readWorkspaceYaml,
} from "./lib/common";

$.nothrow();

const ideConfigmapInfo = await readIDEConfigmapJson();
const ideConfigmapJson = ideConfigmapInfo.parsedObj;
const ideConfigmapJsonObj = ideConfigmapInfo.rawObj;
const workspaceYaml = await readWorkspaceYaml().then((d) => d.parsedObj);

async function updateCodeBrowserVersions() {
    const latestInstaller = await getLatestInstallerVersions();
    const latestBuildImage = {
        code: latestInstaller.components.workspace.codeImage.version,
        webExtension: latestInstaller.components.workspace.codeWebExtensionImage.version,
        codeHelper: latestInstaller.components.workspace.codeHelperImage.version,
    };

    console.log("comparing with latest installer versions", latestInstaller.version, latestBuildImage);

    const firstPinnedInfo = ideConfigmapJson.ideOptions.options.code.versions[0];
    const hasChangedMap = {
        image: !ideConfigmapJson.ideOptions.options.code.image.includes(latestBuildImage.code),
        webExtension: !ideConfigmapJson.ideOptions.options.code.imageLayers[0].includes(latestBuildImage.webExtension),
        codeHelper: !ideConfigmapJson.ideOptions.options.code.imageLayers[1].includes(latestBuildImage.codeHelper),
        pinned: firstPinnedInfo.version !== workspaceYaml.defaultArgs.codeVersion,
    };

    const hasChanged = Object.values(hasChangedMap).some((v) => v);
    if (!hasChanged) {
        console.error("stable version is already up-to-date.");
        return;
    }
    console.log("latest build versions changed, processing...", hasChangedMap);

    const replaceImageHash = (image: string, hash: string) => image.replace(/commit-.*/, hash);
    const updateImages = <T extends { image: string; imageLayers: string[] }>(originData: T) => {
        const data = structuredClone(originData);
        data.image = replaceImageHash(data.image, latestBuildImage.code);
        data.imageLayers[0] = replaceImageHash(data.imageLayers[0], latestBuildImage.webExtension);
        data.imageLayers[1] = replaceImageHash(data.imageLayers[1], latestBuildImage.codeHelper);
        return data;
    };

    const newJson = structuredClone(ideConfigmapJsonObj);
    newJson.ideOptions.options.code = updateImages(newJson.ideOptions.options.code);

    console.log("updating related pinned version", firstPinnedInfo.version, workspaceYaml.defaultArgs.codeVersion);
    const hasPinned = firstPinnedInfo.version === workspaceYaml.defaultArgs.codeVersion;
    if (!hasPinned) {
        newJson.ideOptions.options.code.versions.unshift({
            ...firstPinnedInfo,
            version: workspaceYaml.defaultArgs.codeVersion,
        });
    }
    newJson.ideOptions.options.code.versions[0] = updateImages(newJson.ideOptions.options.code.versions[0]);

    console.log("updating ide-configmap.json");
    await Bun.write(pathToConfigmap, JSON.stringify(newJson, null, 2) + "\n");

    if (hasChangedMap.pinned) {
        console.error("new version released", workspaceYaml.defaultArgs.codeVersion);
        await Bun.write(pathToOutput, `codeVersion=${workspaceYaml.defaultArgs.codeVersion}`);
    }
}

await updateCodeBrowserVersions();
