// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import axios from "axios";
import { z } from "zod";
import semver from "semver";

interface TargetInfo {
    productCode: string;
    productType: string;
    xmlName: string;
    xmlChannels: string[];
    useXml: boolean;
    gradlePropertiesPath: string;
    gradlePropertiesTemplate: string;
}

// ## Product Release
// - For stable builds https://data.services.jetbrains.com/products/releases?code=IIU&type=eap,rc,release&platform=linux

const productReleaseZod = z.record(
    z.string(),
    z.array(
        z.object({
            date: z.string(),
            type: z.string(),
            downloads: z.object({
                linux: z
                    .object({
                        link: z.string(),
                    })
                    .optional(),
            }),
            notesLink: z.string().nullish(),
            whatsnew: z.string().nullish(),
            majorVersion: z.string(), // 2024.2
            build: z.string(), // 242.20224.159
        }),
    ),
);

async function fetchLatestVersionFromProductReleases(info: TargetInfo) {
    const { productCode, productType, useXml } = info;
    const url = `https://data.services.jetbrains.com/products/releases?code=${productCode}&type=${productType}&platform=linux`;
    const response = await axios.get(url);
    const data = productReleaseZod.parse(response.data);
    if (!data[productCode] || data[productCode].length <= 0) {
        throw new Error(`No data found for ${productCode} in ${url}`);
    }
    const latestBuild = data[productCode][0];
    const build = latestBuild.build;
    const buildSem = semver.parse(build);
    if (!buildSem) {
        throw new Error(`Invalid build version ${build}`);
    }
    const latestPlatformVersion = !useXml ? `${buildSem.major}.${buildSem.minor}-EAP-CANDIDATE-SNAPSHOT` : build;
    return {
        pluginSinceBuild: `${buildSem.major}.${buildSem.minor}`,
        pluginUntilBuild: `${buildSem.major}.*`,
        pluginVerifierIdeVersions: latestBuild.majorVersion,
        platformVersion: latestPlatformVersion,
    };
}

// ## Updates XML
// - For latest builds (2024.2) https://www.jetbrains.com/updates/updates.xml
// TODO: Parse XML when necessary

// ##

export async function jbUpdatePlatformVersion(info: TargetInfo) {
    let { gradlePropertiesPath, gradlePropertiesTemplate } = info;
    const newBuildInfo = await fetchLatestVersionFromProductReleases(info);
    console.log("new build info:", newBuildInfo);
    const oldContent = await Bun.file(gradlePropertiesPath).text();
    const regexGroups = /platformVersion=(.*?)$/gm.exec(oldContent);
    const oldPlatformVersion = regexGroups ? regexGroups[1] : "";
    if (!oldPlatformVersion) {
        throw new Error("Failed to find old platform version");
    }
    console.log("old platform version:", oldPlatformVersion);
    if (newBuildInfo.platformVersion === oldPlatformVersion) {
        console.log("No need to update platform version");
        return;
    }
    Object.entries(newBuildInfo).forEach(([key, value]) => {
        gradlePropertiesTemplate = gradlePropertiesTemplate.replace(`{{${key}}}`, value);
    });
    await Bun.write(gradlePropertiesPath, gradlePropertiesTemplate);
    console.log("Updated platform version to:", newBuildInfo.platformVersion);
}
