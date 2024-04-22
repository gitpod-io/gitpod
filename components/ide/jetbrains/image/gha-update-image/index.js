// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.
// @ts-check

const path = require("path");
const yaml = require("yaml");
const fs = require("fs");
const axios = require("axios");
const semver = require("semver");

const JB_PRODUCTS_DATA_URL = "https://data.services.jetbrains.com/products";

const IDEs = [
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
];

(async () => {
    const workspaceYamlFilePath = path.resolve(__dirname, "../../../../../", "WORKSPACE.yaml");
    const backendPluginGradleStableFilePath = path.resolve(
        __dirname,
        "../../backend-plugin",
        "gradle-stable.properties",
    );

    let rawWorkspaceYaml;

    try {
        rawWorkspaceYaml = fs.readFileSync(workspaceYamlFilePath, "utf8");
    } catch (err) {
        console.log("Failed to read config files");
        throw err;
    }

    const workspaceYaml = yaml.parse(rawWorkspaceYaml);

    const requests = [];
    for (const IDE of IDEs) {
        const params = new URLSearchParams({
            code: IDE.productCode,
            "release.type": IDE.productType,
            fields: ["distributions", "link", "name", "releases"].join(","),
            _: Date.now().toString(),
        });

        const url = new URL(JB_PRODUCTS_DATA_URL)
        url.search = params.toString()
        console.log(url)
        requests.push(axios(url.toString()));
    }

    const responses = await Promise.all(requests);

    const uniqueMajorVersions = new Set();
    /** @type {semver.SemVer | undefined} */
    let buildVersion;

    responses.forEach((resp, index) => {
        const lastRelease = resp.data[0].releases[0];
        uniqueMajorVersions.add(lastRelease.majorVersion);
        const oldDownloadUrl = workspaceYaml.defaultArgs[`${IDEs[index].productId}DownloadUrl`];
        rawWorkspaceYaml = rawWorkspaceYaml.replace(oldDownloadUrl, lastRelease.downloads.linux.link);

        const currentBuildVersion = semver.parse(lastRelease.build);
        if (currentBuildVersion && (!buildVersion || semver.gt(currentBuildVersion, buildVersion))) {
            buildVersion = currentBuildVersion;
        }
    });

    const majorVersions = [...uniqueMajorVersions];
    console.log({ majorVersions, buildVersion });

    if (!buildVersion) {
        throw new Error("build version is unresolved");
    }

    if (majorVersions.length !== 1) {
        console.log(`Multiple major versions found, skipping update: ${majorVersions.join(", ")}`);
        return;
    }

    const majorVersion = majorVersions[0];
    console.log(`All IDEs are in the same major version: ${majorVersion}`);

    fs.writeFileSync(workspaceYamlFilePath, rawWorkspaceYaml);
    fs.writeFileSync(
        backendPluginGradleStableFilePath,
        `# this file is auto generated by components/ide/jetbrains/image/gha-update-image/index.js
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

    console.log(`File updated: ${workspaceYamlFilePath}`);
    console.log(`File updated: ${backendPluginGradleStableFilePath}`);
})();
