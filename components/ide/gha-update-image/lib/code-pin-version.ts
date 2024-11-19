// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import { $ } from "bun";
import {
    getIDEVersionOfImage,
    getLatestInstallerVersions,
    pathToConfigmap,
    readIDEConfigmapJson,
    readWorkspaceYaml,
} from "./common";

$.nothrow();

const ideConfigmapInfo = await readIDEConfigmapJson();
const ideConfigmapJson = ideConfigmapInfo.parsedObj;
const ideConfigmapJsonObj = ideConfigmapInfo.rawObj;
const workspaceYaml = await readWorkspaceYaml().then((d) => d.parsedObj);

export async function updateCodeIDEConfigMapJson() {
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
    };

    console.log("image change status", hasChangedMap);

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

    // try append new pin versions
    const previousCodeVersion = await getIDEVersionOfImage("eu.gcr.io/gitpod-core-dev/build/" + ideConfigmapJson.ideOptions.options.code.image.replace("{{.Repository}}/", ""));
    const installationCodeVersion = await getIDEVersionOfImage("eu.gcr.io/gitpod-core-dev/build/" + newJson.ideOptions.options.code.image.replace("{{.Repository}}/", ""));
    if (installationCodeVersion.trim() === "" || previousCodeVersion.trim() === "") {
        throw new Error("installation or previous code version can't be empty");
    }
    let appendNewVersion = false;
    console.log("code versions", { installationCodeVersion, previousCodeVersion });
    if (installationCodeVersion === previousCodeVersion) {
        console.log("code version is the same, no need to update (ide-service will do it)", installationCodeVersion);
    } else {
        const hasPinned = firstPinnedInfo.version === installationCodeVersion;
        if (!hasPinned) {
            console.log("updating related pinned version", installationCodeVersion);
            newJson.ideOptions.options.code.versions.unshift({
                version: previousCodeVersion,
                image: ideConfigmapJsonObj.ideOptions.options.code.image,
                imageLayers: ideConfigmapJsonObj.ideOptions.options.code.imageLayers,
            });
            appendNewVersion = true;
        }
    }

    console.log("updating ide-configmap.json");
    await Bun.write(pathToConfigmap, JSON.stringify(newJson, null, 2) + "\n");
    return appendNewVersion ? workspaceYaml.defaultArgs.codeVersion : undefined;
}
