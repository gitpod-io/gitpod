/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { JetBrainsConfig, TaskConfig, Workspace } from "@gitpod/gitpod-protocol";
import { IDEOptions, IDEClient } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { IDEServiceClient, IDEServiceDefinition } from "@gitpod/ide-service-api/lib/ide.pb";
import { inject, injectable } from "inversify";

export interface IDEConfig {
    supervisorImage: string;
    ideOptions: IDEOptions;
    clients?: { [id: string]: IDEClient };
}
@injectable()
export class IDEService {
    @inject(IDEServiceDefinition.name)
    protected readonly ideService: IDEServiceClient;

    private cacheConfig?: IDEConfig;

    async getIDEConfig(): Promise<IDEConfig> {
        try {
            let resp = await this.ideService.getConfig({});
            let config: IDEConfig = JSON.parse(resp.content);
            this.cacheConfig = config;
            return config;
        } catch (e) {
            console.error("failed get ide config:", e);
            if (this.cacheConfig == null) {
                throw new Error("failed get ide config:" + e.message);
            } else {
                return this.cacheConfig;
            }
        }
    }

    resolveGitpodTasks(ws: Workspace): TaskConfig[] {
        const tasks: TaskConfig[] = [];
        if (ws.config.tasks) {
            tasks.push(...ws.config.tasks);
        }
        // TODO(ak) it is a hack to get users going, we should rather layer JB products on prebuild workspaces and move logic to corresponding images
        if (ws.type === "prebuild" && ws.config.jetbrains) {
            let warmUp = "";
            for (const key in ws.config.jetbrains) {
                let productCode;
                if (key === "intellij") {
                    productCode = "IIU";
                } else if (key === "goland") {
                    productCode = "GO";
                } else if (key === "pycharm") {
                    productCode = "PCP";
                } else if (key === "phpstorm") {
                    productCode = "PS";
                } else if (key === "rubymine") {
                    productCode = "RM";
                } else if (key === "webstorm") {
                    productCode = "WS";
                } else if (key === "rider") {
                    productCode = "RD";
                } else if (key === "clion") {
                    productCode = "CL";
                }
                const prebuilds = productCode && ws.config.jetbrains[key as keyof JetBrainsConfig]?.prebuilds;
                if (prebuilds) {
                    warmUp +=
                        prebuilds.version === "latest"
                            ? ""
                            : `
echo 'warming up stable release of ${key}...'
echo 'downloading stable ${key} backend...'
mkdir /tmp/backend
curl -sSLo /tmp/backend/backend.tar.gz "https://download.jetbrains.com/product?type=release&distribution=linux&code=${productCode}"
tar -xf /tmp/backend/backend.tar.gz --strip-components=1 --directory /tmp/backend

echo 'configuring JB system config and caches aligned with runtime...'
printf '\nshared.indexes.download.auto.consent=true' >> "/tmp/backend/bin/idea.properties"
unset JAVA_TOOL_OPTIONS
export IJ_HOST_CONFIG_BASE_DIR=/workspace/.config/JetBrains
export IJ_HOST_SYSTEM_BASE_DIR=/workspace/.cache/JetBrains

echo 'running stable ${key} backend in warmup mode...'
/tmp/backend/bin/remote-dev-server.sh warmup "$GITPOD_REPO_ROOT"

echo 'removing stable ${key} backend...'
rm -rf /tmp/backend
`;
                    warmUp +=
                        prebuilds.version === "stable"
                            ? ""
                            : `
echo 'warming up latest release of ${key}...'
echo 'downloading latest ${key} backend...'
mkdir /tmp/backend-latest
curl -sSLo /tmp/backend-latest/backend-latest.tar.gz "https://download.jetbrains.com/product?type=release,eap,rc&distribution=linux&code=${productCode}"
tar -xf /tmp/backend-latest/backend-latest.tar.gz --strip-components=1 --directory /tmp/backend-latest

echo 'configuring JB system config and caches aligned with runtime...'
printf '\nshared.indexes.download.auto.consent=true' >> "/tmp/backend-latest/bin/idea.properties"
unset JAVA_TOOL_OPTIONS
export IJ_HOST_CONFIG_BASE_DIR=/workspace/.config/JetBrains-latest
export IJ_HOST_SYSTEM_BASE_DIR=/workspace/.cache/JetBrains-latest

echo 'running ${key} backend in warmup mode...'
/tmp/backend-latest/bin/remote-dev-server.sh warmup "$GITPOD_REPO_ROOT"

echo 'removing latest ${key} backend...'
rm -rf /tmp/backend-latest
`;
                }
            }
            if (warmUp) {
                tasks.push({
                    init: warmUp.trim(),
                });
            }
        }
        return tasks;
    }
}
