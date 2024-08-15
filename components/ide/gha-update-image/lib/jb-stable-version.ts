// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import axios from "axios";
import { $ } from "bun";
import { z } from "zod";
import semver, { SemVer } from "semver";
import {
    pathToWorkspaceYaml,
    pathToBackendPluginGradleStable,
    readWorkspaceYaml,
    readIDEConfigmapJson,
    pathToConfigmap,
} from "./common";
import CompatibilityJson from "../constant/jetbrains-compatibility.json";

$.nothrow(); // git likes to respond with non-zero codes, but it is alright for us

const JB_PRODUCTS_DATA_URL = "https://data.services.jetbrains.com/products";

const jbReleaseResponse = z.array(
    z.object({
        name: z.string(),
        link: z.string(),
        releases: z.array(
            z.object({
                majorVersion: z.string(),
                build: z.string(),
                downloads: z.object({
                    linux: z
                        .object({
                            link: z.string(),
                        })
                        .optional(),
                }),
            }),
        ),
    }),
);

export interface JetBrainsIDE {
    productName: string;
    productId: string;
    productCode: string;
    productType: string;
    exampleRepo: string;
}

export const ides: JetBrainsIDE[] = [
    {
        productName: "IntelliJ IDEA Ultimate",
        productId: "intellij",
        productCode: "IIU",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-samples/spring-petclinic",
    },
    {
        productName: "GoLand",
        productId: "goland",
        productCode: "GO",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-samples/template-golang-cli",
    },
    {
        productName: "PyCharm Professional Edition",
        productId: "pycharm",
        productCode: "PCP",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-samples/template-python-django",
    },
    {
        productName: "PhpStorm",
        productId: "phpstorm",
        productCode: "PS",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-samples/template-php-laravel-mysql",
    },
    {
        productName: "RubyMine",
        productId: "rubymine",
        productCode: "RM",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-samples/template-ruby-on-rails-postgres",
    },
    {
        productName: "WebStorm",
        productId: "webstorm",
        productCode: "WS",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-samples/template-typescript-react",
    },
    {
        productName: "Rider",
        productId: "rider",
        productCode: "RD",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-samples/template-dotnet-core-cli-csharp",
    },
    {
        productName: "CLion",
        productId: "clion",
        productCode: "CL",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-samples/template-cpp",
    },
    {
        productName: "RustRover",
        productId: "rustrover",
        productCode: "RR",
        productType: "release",
        exampleRepo: "https://github.com/gitpod-samples/template-rust-cli",
    },
] as const;

const workspaceYamlInfo = await readWorkspaceYaml();
let rawWorkspace = workspaceYamlInfo.rawText;
const workspace = workspaceYamlInfo.parsedObj;

interface getStableVersionsInfoResult {
    buildVersion: semver.SemVer;
    buildPlatformVersion: string;
    majorVersion: string;
    /**
     * key: ide.productId
     * value: pluginSinceBuild
     */
    updatedIDEMap: Map<string, string>;
}

/**
 * get the latest (highest) stable version of JetBrains IDEs
 */
export const getStableVersionsInfo = async (ides: JetBrainsIDE[]): Promise<getStableVersionsInfoResult> => {
    let buildVersion: semver.SemVer | undefined;
    let majorVersion: string | undefined;
    let buildPlatformVersion: string | undefined;

    const majorVersions = new Map<string, string>();
    const majorBuildVersions = new Map<string, string>();
    const updatedIDEMap = new Map<string, string>();

    await Promise.all(
        ides.map(async (ide) => {
            const params = new URLSearchParams({
                code: ide.productCode,
                "release.type": ide.productType,
                fields: ["distributions", "link", "name", "releases"].join(","),
                _: Date.now().toString(),
            });

            const url = new URL(JB_PRODUCTS_DATA_URL);
            url.search = params.toString();
            console.debug(`Fetching data for ${ide.productId.padStart(8, " ")}: ${url.toString()}`);
            const resp = await axios(url.toString());

            const parsedResponse = jbReleaseResponse.parse(resp.data);
            const lastRelease = parsedResponse[0].releases[0];
            const downloadLink = lastRelease.downloads?.linux?.link;
            console.log(
                `Latest ${ide.productId.padEnd(8, " ")} majorVersion: ${lastRelease.majorVersion}, buildVersion: ${
                    lastRelease.build
                }, download link: ${downloadLink}`,
            );

            majorVersions.set(ide.productId, lastRelease.majorVersion);

            const currentBuildVersion = semver.parse(lastRelease.build);
            if (!currentBuildVersion) {
                throw new Error("Failed to parse the build version: " + lastRelease.build);
            }

            const ideKey = `${ide.productId}DownloadUrl` as const;
            const oldDownloadUrl = workspace.defaultArgs[ideKey];
            if (!downloadLink) {
                throw new Error("No download link found for the latest release");
            }
            rawWorkspace = rawWorkspace.replace(oldDownloadUrl, downloadLink);
            if (oldDownloadUrl !== downloadLink) {
                updatedIDEMap.set(ide.productId, `${currentBuildVersion.major}.${currentBuildVersion.minor}`);
            }

            majorBuildVersions.set(ide.productId, currentBuildVersion.major.toString());

            if (!buildVersion || semver.gt(currentBuildVersion, buildVersion)) {
                buildVersion = currentBuildVersion;
                buildPlatformVersion = lastRelease.build;
                majorVersion = lastRelease.majorVersion;
            }
        }),
    );

    console.log("result:", { majorVersions, majorBuildVersions, buildVersion, updatedIDEMap });

    if (!buildVersion) {
        throw new Error("build version is unresolved");
    }

    const result: getStableVersionsInfoResult = {
        buildVersion,
        buildPlatformVersion: buildPlatformVersion!,
        majorVersion: majorVersion!,
        updatedIDEMap,
    };
    return result;
};

export const upgradeStableVersionsInWorkspaceaAndGradle = async () => {
    const { buildVersion, buildPlatformVersion, majorVersion, updatedIDEMap } = await getStableVersionsInfo(ides);
    // Update WORKSPACE.yaml
    await Bun.write(pathToWorkspaceYaml, rawWorkspace);
    console.log(`File updated: ${pathToWorkspaceYaml}`);

    // Update gradle-stable.properties
    await Bun.write(
        pathToBackendPluginGradleStable,
        `# this file is auto generated by components/ide/gha-update-image/index-jb.ts
# See https://plugins.jetbrains.com/docs/intellij/build-number-ranges.html
# for insight into build numbers and IntelliJ Platform versions.
pluginSinceBuild=${buildVersion.major}.${buildVersion.minor}
pluginUntilBuild=${buildVersion.major}.*
# Plugin Verifier integration -> https://github.com/JetBrains/gradle-intellij-plugin#plugin-verifier-dsl
# See https://jb.gg/intellij-platform-builds-list for available build versions.
pluginVerifierIdeVersions=${majorVersion}
# Version from "com.jetbrains.intellij.idea" which can be found at https://www.jetbrains.com/intellij-repository/snapshots
platformVersion=${buildPlatformVersion}
`,
    );
    console.log(`File updated: ${pathToBackendPluginGradleStable}`);

    // Update ide-configmap.json's backend-plugin versions
    const ideConfigmap = await readIDEConfigmapJson();
    for (const [productId, pluginSinceBuild] of Object.entries(updatedIDEMap)) {
        const config = ideConfigmap.rawObj.ideOptions.options[productId];

        const info = getCompatibleImageInfo(productId, pluginSinceBuild, CompatibilityJson);
        config.pluginImage = `{{.Repository}}/ide/jb-backend-plugin:${info.backendPluginHash}`;
        if (!config._mainBuilt) {
            config._mainBuilt = true;
        }
    }
    await Bun.write(pathToConfigmap, JSON.stringify(ideConfigmap.rawObj, null, 2));
    console.log(`File updated: ${pathToConfigmap}`);

    return Object.keys(updatedIDEMap);
};

export const getCompatibleImageInfo = (
    productId: string,
    pluginSinceBuild: string,
    CompatibilityJson: { versions: { pluginSinceBuild: string; backendPlugin: string }[] },
) => {
    const targetSemVer = semver.parse(pluginSinceBuild);
    if (!targetSemVer) {
        throw new Error(`Failed to parse target semver: ${pluginSinceBuild}`);
    }
    let compatibleVersion: SemVer | undefined;
    let backendPluginHash: string | undefined;
    for (const item of CompatibilityJson.versions) {
        const itemSemVer = semver.parse(item.pluginSinceBuild);
        if (!itemSemVer) {
            throw new Error(`Failed to parse item semver: ${item.pluginSinceBuild}`);
        }
        if (semver.gte(targetSemVer, itemSemVer)) {
            compatibleVersion = itemSemVer;
            backendPluginHash = item.backendPlugin;
        } else {
            break;
        }
    }
    if (!compatibleVersion) {
        throw new Error(`No compatible version found for ${productId}`);
    }
    return {
        compatibleVersion,
        backendPluginHash,
    };
};
