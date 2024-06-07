// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import axios from "axios";
import { $ } from "bun";
import { z } from "zod";
import semver from "semver";
import { MultipleBuildVersionsError, MultipleMajorVersionsError } from "./errors";
import { pathToWorkspaceYaml, pathToBackendPluginGradleStable, readWorkspaceYaml } from "./common";

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

export const getStableVersionsInfo = async (ides: JetBrainsIDE[]) => {
    let buildVersion: semver.SemVer | undefined;

    const uniqueMajorVersions = new Set<string>();
    const uniqueMajorBuildVersions = new Set<string>();

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
            console.log(
                `Latest ${ide.productId.padEnd(8, " ")} majorVersion: ${lastRelease.majorVersion}, buildVersion: ${
                    lastRelease.build
                }`,
            );

            uniqueMajorVersions.add(lastRelease.majorVersion);

            const ideKey = `${ide.productId}DownloadUrl` as const;
            const oldDownloadUrl = workspace.defaultArgs[ideKey];

            const downloadLink = lastRelease.downloads?.linux?.link;
            if (!downloadLink) {
                throw new Error("No download link found for the latest release");
            }
            rawWorkspace = rawWorkspace.replace(oldDownloadUrl, downloadLink);

            const currentBuildVersion = semver.parse(lastRelease.build);
            if (!currentBuildVersion) {
                throw new Error("Failed to parse the build version: " + lastRelease.build);
            }
            uniqueMajorBuildVersions.add(currentBuildVersion.major.toString());
            // Use minimal common build version, within the same major version there should have no breaking changes
            if (!buildVersion || semver.lt(currentBuildVersion, buildVersion)) {
                buildVersion = currentBuildVersion;
            }
        }),
    );

    const majorVersions = [...uniqueMajorVersions];
    const majorBuildVersions = [...uniqueMajorBuildVersions];
    console.log({ majorVersions, majorBuildVersions, buildVersion });

    if (!buildVersion) {
        throw new Error("build version is unresolved");
    }
    if (majorBuildVersions.length !== 1) {
        throw new MultipleBuildVersionsError(majorBuildVersions);
    }

    if (majorVersions.length !== 1) {
        throw new MultipleMajorVersionsError(majorVersions);
    }

    const majorVersion = majorVersions[0];
    console.log(`All IDEs are in the same major version: ${majorVersion}`);

    return { buildVersion, majorVersion };
};

export const upgradeStableVersionsInWorkspaceaAndGradle = async () => {
    try {
        const { buildVersion, majorVersion } = await getStableVersionsInfo(ides);
        await Bun.write(pathToWorkspaceYaml, rawWorkspace);

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
platformVersion=${buildVersion.major}.${buildVersion.minor}-EAP-CANDIDATE-SNAPSHOT
`,
        );

        console.log(`File updated: ${pathToWorkspaceYaml}`);
        console.log(`File updated: ${pathToBackendPluginGradleStable}`);
    } catch (e) {
        if (e instanceof MultipleMajorVersionsError || e instanceof MultipleBuildVersionsError) {
            console.error(e.message);
            return;
        }
        throw e;
    }
};
