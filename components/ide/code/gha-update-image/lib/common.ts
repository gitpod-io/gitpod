// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import { $ } from "bun";
import path from "path";
import yaml from "yaml";
import { z } from "zod";

const pathToProjectRoot = path.resolve(__dirname, "../../../../../");

export const pathToWorkspaceYaml = path.resolve(pathToProjectRoot, "WORKSPACE.yaml");

export const pathToConfigmap = path.resolve(
    pathToProjectRoot,
    "install/installer/pkg/components/ide-service/ide-configmap.json",
);

export const rawWorkspaceYaml = await Bun.file(pathToWorkspaceYaml).text()
export const workspaceYamlObj = yaml.parse(rawWorkspaceYaml);
export const workspaceYaml = z
    .object({
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
        }),
    })
    .parse(workspaceYamlObj);

export const ideConfigmapJsonObj = JSON.parse(await Bun.file(pathToConfigmap).text());
export const ideConfigmapJson = z
    .object({
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
    })
    .parse(ideConfigmapJsonObj);

export const getLatestInstallerVersions = async (version?: string) => {
    const v = version ? version : "main-gha.";
    const tagInfo =
        await $`git ls-remote --tags --sort=-v:refname https://github.com/gitpod-io/gitpod | grep ${v} | head -n1`
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

    const versionObj = z.object({ version: z.string() });
    return z
        .object({
            version: z.string(),
            components: z.object({
                workspace: z.object({
                    codeImage: versionObj,
                    codeHelperImage: versionObj,
                    codeWebExtensionImage: versionObj,
                    desktopIdeImages: z.record(z.string(), z.object({ version: z.string() })),
                }),
            }),
        })
        .parse(yaml.parse(versionData));
};
