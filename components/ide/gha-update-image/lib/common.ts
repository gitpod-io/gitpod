// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import { $ } from "bun";
import path from "path";
import yaml from "yaml";
import { z } from "zod";

export const pathToProjectRoot = path.resolve(__dirname, "../../../../");

const pathToOutput = path.resolve("/tmp/__gh_output.txt");

export const appendGitHubOutput = async (kv: string) => {
    console.log("Appending to GitHub output:", kv);
    return await $`echo ${kv} >> ${pathToOutput}`;
};

// WORKSPACE.yaml
export const pathToWorkspaceYaml = path.resolve(pathToProjectRoot, "WORKSPACE.yaml");
const workspaceYamlSchema = z.object({
    defaultArgs: z.object({
        codeCommit: z.string(),
        codeVersion: z.string(),
        codeWebExtensionCommit: z.string(),

        intellijDownloadUrl: z.string(),
        golandDownloadUrl: z.string(),
        pycharmDownloadUrl: z.string(),
        phpstormDownloadUrl: z.string(),
        rubymineDownloadUrl: z.string(),
        webstormDownloadUrl: z.string(),
        riderDownloadUrl: z.string(),
        clionDownloadUrl: z.string(),
        rustroverDownloadUrl: z.string(),
    }),
});
export type IWorkspaceYaml = z.infer<typeof workspaceYamlSchema>;
export const readWorkspaceYaml = async () => {
    const rawWorkspaceYaml = await Bun.file(pathToWorkspaceYaml).text();
    const workspaceYamlObj = yaml.parse(rawWorkspaceYaml);
    const workspaceYaml = workspaceYamlSchema.parse(workspaceYamlObj);
    return {
        rawText: rawWorkspaceYaml,
        rawObj: workspaceYamlObj,
        parsedObj: workspaceYaml,
    };
};

// gradle-stable.properties
export const pathToBackendPluginGradleStable = path.resolve(
    pathToProjectRoot,
    "components/ide/jetbrains/backend-plugin/gradle-stable.properties",
);

// ide-configmap.json
export const pathToConfigmap = path.resolve(
    pathToProjectRoot,
    "install/installer/pkg/components/ide-service/ide-configmap.json",
);

const IDEOptionSchema = z.object({
    image: z.string(),
    imageLayers: z.array(z.string()),
    versions: z.array(
        z.object({
            version: z.string(),
            image: z.string(),
            imageLayers: z.array(z.string()),
        }),
    ),
});
const ideConfigmapJsonSchema = z.object({
    supervisorImage: z.string(),
    ideOptions: z.object({
        options: z.object({
            code: IDEOptionSchema,
            intellij: IDEOptionSchema,
            goland: IDEOptionSchema,
            pycharm: IDEOptionSchema,
            phpstorm: IDEOptionSchema,
            rubymine: IDEOptionSchema,
            webstorm: IDEOptionSchema,
            rider: IDEOptionSchema,
            clion: IDEOptionSchema,
            rustrover: IDEOptionSchema,
        }),
    }),
});
export type IIdeConfigmapJson = z.infer<typeof ideConfigmapJsonSchema>;
export const readIDEConfigmapJson = async () => {
    const ideConfigmapJsonText = await Bun.file(pathToConfigmap).text();
    const ideConfigmapJsonObj = JSON.parse(ideConfigmapJsonText);
    const ideConfigmapJson = ideConfigmapJsonSchema.parse(ideConfigmapJsonObj);
    return {
        rawText: ideConfigmapJsonText,
        rawObj: ideConfigmapJsonObj,
        parsedObj: ideConfigmapJson,
    };
};

const getInstallerVersion = async (version: string | undefined) => {
    const v = version ? version : "main-gha.";
    let tagInfo: string;
    try {
        tagInfo =
            await $`git ls-remote --tags --sort=-v:refname https://github.com/gitpod-io/gitpod | grep ${v} | head -n1`.text();
    } catch (e) {
        if (e && e.exitCode === 141 && e.stdout) {
            tagInfo = String(e.stdout);
        } else {
            throw new Error("Failed to fetch the latest main-gha. git tag: " + e.message);
        }
    }
    const installationVersion =
        await $`echo '${tagInfo}' | awk '{ print $2 }' | grep -o 'main-gha.[0-9]*' | cut -d'/' -f3`
            .text()
            .catch((e) => {
                throw new Error("Failed to parse installer version from git tag: " + e);
            });
    return installationVersion.replaceAll("\n", "");
};

// installer versions
export const getLatestInstallerVersions = async (version?: string) => {
    const installationVersion = await getInstallerVersion(version);
    console.log("Fetching installer versions for", installationVersion);
    const versionData =
        await $`docker run --rm eu.gcr.io/gitpod-core-dev/build/versions:${installationVersion} cat /versions.yaml`
            .text()
            .catch((e) => {
                throw new Error("Failed to get installer versions: " + e);
            });

    const versionObj = z.object({ version: z.string() });
    return z
        .object({
            version: z.string(),
            commit: z.string(),
            components: z.object({
                workspace: z.object({
                    codeImage: versionObj,
                    codeHelperImage: versionObj,
                    codeWebExtensionImage: versionObj,
                    desktopIdeImages: z.object({
                        clion: versionObj,
                        clionLatest: versionObj,
                        codeDesktop: versionObj,
                        codeDesktopInsiders: versionObj,
                        goland: versionObj,
                        golandLatest: versionObj,
                        intellij: versionObj,
                        intellijLatest: versionObj,
                        jbBackendPlugin: versionObj,
                        jbBackendPluginLatest: versionObj,
                        jbBackendPluginRider: versionObj,
                        jbBackendPluginLatestRider: versionObj,
                        jbLauncher: versionObj,
                        phpstorm: versionObj,
                        phpstormLatest: versionObj,
                        pycharm: versionObj,
                        pycharmLatest: versionObj,
                        rider: versionObj,
                        riderLatest: versionObj,
                        rubymine: versionObj,
                        rubymineLatest: versionObj,
                        rustrover: versionObj,
                        rustroverLatest: versionObj,
                        webstorm: versionObj,
                        webstormLatest: versionObj,
                    }),
                }),
            }),
        })
        .parse(yaml.parse(versionData));
};

export const renderInstallerIDEConfigMap = async (version?: string) => {
    const installationVersion = await getInstallerVersion(version);
    await $`docker run --rm -v /tmp:/tmp eu.gcr.io/gitpod-core-dev/build/installer:${installationVersion} config init --overwrite --log-level=error -c /tmp/gitpod.config.yaml`.catch(
        (e) => {
            throw new Error("Failed to render gitpod.config.yaml: " + e);
        },
    );
    const ideConfigMapStr =
        await $`cat /tmp/gitpod.config.yaml | docker run -i --rm eu.gcr.io/gitpod-core-dev/build/installer:${installationVersion} ide-configmap -c -`
            .text()
            .catch((e) => {
                throw new Error(`Failed to render ide-configmap: ` + e);
            });
    const ideConfigmapJsonObj = JSON.parse(ideConfigMapStr);
    const ideConfigmapJson = ideConfigmapJsonSchema.parse(ideConfigmapJsonObj);
    return ideConfigmapJson;
};

export const getIDEVersionOfImage = async (img: string) => {
    console.log(
        "Fetching IDE version in image:",
        `oci-tool fetch image ${img} | jq -r '.config.Labels["io.gitpod.ide.version"]'`,
    );
    const version = await $`oci-tool fetch image ${img} | jq -r '.config.Labels["io.gitpod.ide.version"]'`
        .text()
        .catch((e) => {
            throw new Error("Failed to fetch ide version in image: " + e);
        })
        .then((str) => str.replaceAll("\n", ""));
    console.log("IDE version in image:", version);
    return version;
};
