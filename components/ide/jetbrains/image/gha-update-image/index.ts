import axios from "axios";
import { $ } from "bun";
import path from "path";
import yaml from "yaml";
import { z } from "zod";
import semver from "semver";

$.nothrow(); // git likes to respond with non-zero codes, but it is alright for us

const JB_PRODUCTS_DATA_URL = "https://data.services.jetbrains.com/products";

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

const jbReleaseResponse = z.array(z.object({
    name: z.string(),
    link: z.string(),
    releases: z.array(z.object({
        majorVersion: z.string(),
        build: z.string(),
        downloads: z.object({
            linux: z.object({
                link: z.string(),
            }).optional(),
        }),
    })),
}))

export const ides = [
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
] as const;

const pathToConfigmap = path.resolve(
    __dirname,
    "../../../../../",
    "install/installer/pkg/components/ide-service/ide-configmap.json",
);
const pathToWorkspaceYaml = path.resolve(__dirname, "../../../../../", "WORKSPACE.yaml");
const backendPluginGradleStableFilePath = path.resolve(__dirname, "../../backend-plugin", "gradle-stable.properties");

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

const updateLatestVersionsInWorkspaceaAndGradle = async () => {
    const requests: Promise<any>[] = [];
    for (const IDE of ides) {
        const params = new URLSearchParams({
            code: IDE.productCode,
            "release.type": IDE.productType,
            fields: ["distributions", "link", "name", "releases"].join(","),
            _: Date.now().toString(),
        });

        const url = new URL(JB_PRODUCTS_DATA_URL);
        url.search = params.toString();
        requests.push(axios(url.toString()));
    }

    let buildVersion: semver.SemVer | undefined;

    const responses = await Promise.all(requests);
    const uniqueMajorVersions = new Set();

    responses.forEach((resp, index) => {
        const parsedResponse = jbReleaseResponse.parse(resp.data);
        const lastRelease = parsedResponse[0].releases[0];
        uniqueMajorVersions.add(lastRelease.majorVersion);

        const ideKey = `${ides[index].productId}DownloadUrl` as const
        const oldDownloadUrl = workspace.defaultArgs[ideKey];

        const downloadLink = lastRelease.downloads?.linux?.link;
        if (!downloadLink) {
            throw new Error("No download link found for the latest release");
        }
        rawWorkspace = rawWorkspace.replace(oldDownloadUrl, downloadLink);

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

    await Bun.write(pathToWorkspaceYaml, rawWorkspace);

    await Bun.write(
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

    console.log(`File updated: ${pathToWorkspaceYaml}`);
    console.log(`File updated: ${backendPluginGradleStableFilePath}`);
};

const updateLatestVersionsInConfigmap = async () => {
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
            if (!currentVersion.image.includes(installerImageVersion)) {
                if (currentVersion.version === ideVersion) {
                    // Update the current version
                    configmap.ideOptions.options[ide].versions[0] = installerIdeVersion;
                    console.log(`Updated ${ide} (old ${currentVersion.image}, new ${installerIdeVersion.image})`);
                } else {
                    configmap.ideOptions.options[ide].versions.unshift(installerIdeVersion);
                    console.log(`Added ${ide} (new ${installerIdeVersion.image})`);
                }
            } else {
                console.log(`Not updating, ${ide} is up-to-date`);
            }
        }
    }

    await Bun.write(pathToConfigmap, JSON.stringify(configmap, null, 2) + "\n");
    console.log(`File updated: ${pathToConfigmap}`);
};

await updateLatestVersionsInWorkspaceaAndGradle();
await updateLatestVersionsInConfigmap();
