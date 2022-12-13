/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    IDESettings,
    JetBrainsConfig,
    TaskConfig,
    User,
    WithReferrerContext,
    Workspace,
} from "@gitpod/gitpod-protocol";
import { IDEOptions, IDEClient, IDEOption } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import {
    IDEServiceClient,
    IDEServiceDefinition,
    ResolveWorkspaceConfigResponse,
} from "@gitpod/ide-service-api/lib/ide.pb";
import * as IdeServiceApi from "@gitpod/ide-service-api/lib/ide.pb";
import { inject, injectable } from "inversify";
import { AuthorizationService } from "./user/authorization-service";
import { ConfigCatClientFactory } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { deepEqual } from "assert";

export interface IDEConfig {
    supervisorImage: string;
    ideOptions: IDEOptions;
    clients?: { [id: string]: IDEClient };
}
@injectable()
export class IDEService {
    @inject(IDEServiceDefinition.name)
    protected readonly ideService: IDEServiceClient;

    @inject(AuthorizationService)
    protected readonly authService: AuthorizationService;

    @inject(ConfigCatClientFactory)
    protected readonly configCatClientFactory: ConfigCatClientFactory;

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

    migrateSettings(user: User): IDESettings | undefined {
        if (!user?.additionalData?.ideSettings || user.additionalData.ideSettings.settingVersion === "2.0") {
            return undefined;
        }
        const newIDESettings: IDESettings = {
            settingVersion: "2.0",
        };
        const ideSettings = user.additionalData.ideSettings;
        if (ideSettings.useDesktopIde) {
            if (ideSettings.defaultDesktopIde === "code-desktop") {
                newIDESettings.defaultIde = "code-desktop";
            } else if (ideSettings.defaultDesktopIde === "code-desktop-insiders") {
                newIDESettings.defaultIde = "code-desktop";
                newIDESettings.useLatestVersion = true;
            } else {
                newIDESettings.defaultIde = ideSettings.defaultDesktopIde;
                newIDESettings.useLatestVersion = ideSettings.useLatestVersion;
            }
        } else {
            const useLatest = ideSettings.defaultIde === "code-latest";
            newIDESettings.defaultIde = "code";
            newIDESettings.useLatestVersion = useLatest;
        }
        return newIDESettings;
    }

    async resolveWorkspaceConfig(workspace: Workspace, user: User): Promise<ResolveWorkspaceConfigResponse> {
        const use = await this.configCatClientFactory().getValueAsync("use_IDEService_ResolveWorkspaceConfig", false, {
            user,
        });
        if (use) {
            return this.doResolveWorkspaceConfig(workspace, user);
        }

        const deprecated = await this.resolveDeprecated(workspace, user);
        // assert against ide-service
        (async () => {
            const config = await this.doResolveWorkspaceConfig(workspace, user);
            const { tasks: configTasks, ...newConfig } = config;
            const { tasks: deprecatedTasks, ...newDeprecated } = deprecated;
            // we omit tasks because we're going to rewrite them soon and the deepEqual was failing
            deepEqual(newConfig, newDeprecated);
        })().catch((e) => console.error("ide-service: assert workspace config failed:", e));
        return deprecated;
    }

    private async doResolveWorkspaceConfig(workspace: Workspace, user: User): Promise<ResolveWorkspaceConfigResponse> {
        const workspaceType =
            workspace.type === "prebuild" ? IdeServiceApi.WorkspaceType.PREBUILD : IdeServiceApi.WorkspaceType.REGULAR;

        const req: IdeServiceApi.ResolveWorkspaceConfigRequest = {
            type: workspaceType,
            context: JSON.stringify(workspace.context),
            ideSettings: JSON.stringify(user.additionalData?.ideSettings),
            workspaceConfig: JSON.stringify(workspace.config),
        };
        for (let attempt = 0; attempt < 15; attempt++) {
            if (attempt != 0) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            try {
                const resp = await this.tryResolveWorkspaceConfig(req);
                return resp;
            } catch (e) {
                console.error("ide-service: failed to resolve workspace config: ", e);
            }
        }
        throw new Error("failed to resolve workspace IDE configuration");
    }

    private tryResolveWorkspaceConfig(
        req: IdeServiceApi.ResolveWorkspaceConfigRequest,
    ): Promise<ResolveWorkspaceConfigResponse> {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);
        return this.ideService.resolveWorkspaceConfig(req, {
            signal: controller.signal,
        });
    }

    resolveGitpodTasks(ws: Workspace, ideConfig: ResolveWorkspaceConfigResponse): TaskConfig[] {
        const tasks: TaskConfig[] = [];
        if (ws.config.tasks) {
            tasks.push(...ws.config.tasks);
        }
        if (ideConfig.tasks) {
            try {
                let ideTasks: TaskConfig[] = JSON.parse(ideConfig.tasks);
                tasks.push(...ideTasks);
            } catch (e) {
                console.error("failed get tasks from ide config:", e);
            }
        }
        return tasks;
    }

    //#region deprecated
    private async resolveDeprecated(workspace: Workspace, user: User): Promise<ResolveWorkspaceConfigResponse> {
        const ideConfig = await this.getIDEConfig();

        const ideChoice = user.additionalData?.ideSettings?.defaultIde;
        const useLatest = !!user.additionalData?.ideSettings?.useLatestVersion;

        let ideImage: string | undefined;
        let desktopIdeImage: string | undefined;
        let desktopIdePluginImage: string | undefined;
        if (!!ideChoice) {
            const choose = this.chooseIDE(
                ideChoice,
                ideConfig.ideOptions,
                useLatest,
                this.authService.hasPermission(user, "ide-settings"),
            );
            ideImage = choose.ideImage;
            desktopIdeImage = choose.desktopIdeImage;
            desktopIdePluginImage = choose.desktopIdePluginImage;
        }

        const referrerIde = this.resolveReferrerIDE(workspace, user, ideConfig);
        if (referrerIde) {
            desktopIdeImage = useLatest
                ? referrerIde.option.latestImage ?? referrerIde.option.image
                : referrerIde.option.image;
            desktopIdePluginImage = useLatest
                ? referrerIde.option.pluginLatestImage ?? referrerIde.option.pluginImage
                : referrerIde.option.pluginImage;
        }

        const envvars: IdeServiceApi.EnvironmentVariable[] = [];
        const ideAlias = user.additionalData?.ideSettings?.defaultIde;
        if (ideAlias && ideConfig.ideOptions.options[ideAlias]) {
            envvars.push({
                name: "GITPOD_IDE_ALIAS",
                value: ideAlias,
            });
        }

        if (!!ideImage) {
            ideImage = ideImage;
        } else {
            ideImage = ideConfig.ideOptions.options[ideConfig.ideOptions.defaultIde].image;
        }

        const ideImageLayers: string[] = [];
        if (desktopIdeImage) {
            ideImageLayers.push(desktopIdeImage);
            if (desktopIdePluginImage) {
                ideImageLayers.push(desktopIdePluginImage);
            }
        }

        const tasks = [];
        // TODO(ak) it is a hack to get users going, we should rather layer JB products on prebuild workspaces and move logic to corresponding images
        if (workspace.type === "prebuild" && workspace.config.jetbrains) {
            let warmUp = "";
            for (const key in workspace.config.jetbrains) {
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
                const prebuilds = productCode && workspace.config.jetbrains[key as keyof JetBrainsConfig]?.prebuilds;
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

        return {
            supervisorImage: ideConfig.supervisorImage,
            webImage: ideImage,
            refererIde: referrerIde?.id ?? "",
            ideImageLayers,
            envvars,
            tasks: tasks.length === 0 ? "" : JSON.stringify(tasks),
        };
    }

    private chooseIDE(ideChoice: string, ideOptions: IDEOptions, useLatest: boolean, hasIdeSettingPerm: boolean) {
        const defaultIDEOption = ideOptions.options[ideOptions.defaultIde];
        const defaultIdeImage = useLatest
            ? defaultIDEOption.latestImage ?? defaultIDEOption.image
            : defaultIDEOption.image;
        const data: { desktopIdeImage?: string; desktopIdePluginImage?: string; ideImage: string } = {
            ideImage: defaultIdeImage,
        };
        const chooseOption = ideOptions.options[ideChoice] ?? defaultIDEOption;
        const isDesktopIde = chooseOption.type === "desktop";
        if (isDesktopIde) {
            data.desktopIdeImage = useLatest ? chooseOption?.latestImage ?? chooseOption?.image : chooseOption?.image;
            data.desktopIdePluginImage = useLatest
                ? chooseOption?.pluginLatestImage ?? chooseOption?.pluginImage
                : chooseOption?.pluginImage;
            if (hasIdeSettingPerm) {
                data.desktopIdeImage = data.desktopIdeImage || ideChoice;
            }
        } else {
            data.ideImage = useLatest ? chooseOption?.latestImage ?? chooseOption?.image : chooseOption?.image;
            if (hasIdeSettingPerm) {
                data.ideImage = data.ideImage || ideChoice;
            }
        }
        if (!data.ideImage) {
            data.ideImage = defaultIdeImage;
            // throw new Error("cannot choose correct browser ide");
        }
        return data;
    }

    private resolveReferrerIDE(
        workspace: Workspace,
        user: User,
        ideConfig: IDEConfig,
    ): { id: string; option: IDEOption } | undefined {
        if (!WithReferrerContext.is(workspace.context)) {
            return undefined;
        }
        const referrer = ideConfig.ideOptions.clients?.[workspace.context.referrer];
        if (!referrer) {
            return undefined;
        }

        const providedIde = workspace.context.referrerIde;
        const providedOption = providedIde && ideConfig.ideOptions.options[providedIde];
        if (providedOption && referrer.desktopIDEs?.some((ide) => ide === providedIde)) {
            return { id: providedIde, option: providedOption };
        }

        const defaultDesktopIde = user.additionalData?.ideSettings?.defaultDesktopIde;
        const userOption = defaultDesktopIde && ideConfig.ideOptions.options[defaultDesktopIde];
        if (userOption && referrer.desktopIDEs?.some((ide) => ide === defaultDesktopIde)) {
            return { id: defaultDesktopIde, option: userOption };
        }

        const defaultIde = referrer.defaultDesktopIDE;
        const defaultOption = defaultIde && ideConfig.ideOptions.options[defaultIde];
        if (defaultOption) {
            return { id: defaultIde, option: defaultOption };
        }

        return undefined;
    }
    //#endregion
}
