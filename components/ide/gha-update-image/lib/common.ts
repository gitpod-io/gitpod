// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import { $ } from "bun";
import path from "path";
import yaml from "yaml";
import { z } from "zod";

const pathToProjectRoot = path.resolve(__dirname, "../../../../");

export const pathToOutput = path.resolve("/tmp/__gh_output.txt");

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
const ideConfigmapJsonSchema = z.object({
    supervisorImage: z.string(),
    ideOptions: z.object({
        options: z.object({
            code: z.object({
                image: z.string(),
                imageLayers: z.array(z.string()),
                versions: z.array(
                    z.object({
                        version: z.string(),
                        image: z.string(),
                        imageLayers: z.array(z.string()),
                    }),
                ),
            }),
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

// installer versions
export const getLatestInstallerVersions = async (version?: string) => {
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
                throw new Error("Failed to parse installer version from git tag", e);
            });
    // exec command below to see results
    // ```
    // $ docker run --rm eu.gcr.io/gitpod-core-dev/build/versions:main-gha.25759 cat /versions.yaml | yq r -
    // ```
    const versionData =
        await $`docker run --rm eu.gcr.io/gitpod-core-dev/build/versions:${installationVersion.trim()} cat /versions.yaml`
            .text()
            .catch((e) => {
                throw new Error("Failed to fetch versions.yaml from latest installer", e);
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
