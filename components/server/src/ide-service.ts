/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { IDESettings, User, Workspace } from "@gitpod/gitpod-protocol";
import { IDEClient, IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import * as IdeServiceApi from "@gitpod/ide-service-api/lib/ide.pb";
import {
    IDEServiceClient,
    IDEServiceDefinition,
    ResolveWorkspaceConfigResponse,
} from "@gitpod/ide-service-api/lib/ide.pb";
import { inject, injectable } from "inversify";
import { AuthorizationService } from "./user/authorization-service";

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

    private cacheConfig?: IDEConfig;

    async getIDEConfig(request: { user: { id: string; email?: string } }): Promise<IDEConfig> {
        try {
            const response = await this.ideService.getConfig(request);
            const config: IDEConfig = JSON.parse(response.content);
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

    async resolveWorkspaceConfig(
        workspace: Workspace,
        user: User,
        userSelectedIdeSettings?: IDESettings,
    ): Promise<ResolveWorkspaceConfigResponse> {
        const workspaceType =
            workspace.type === "prebuild" ? IdeServiceApi.WorkspaceType.PREBUILD : IdeServiceApi.WorkspaceType.REGULAR;

        const req: IdeServiceApi.ResolveWorkspaceConfigRequest = {
            type: workspaceType,
            context: JSON.stringify(workspace.context),
            ideSettings: JSON.stringify(userSelectedIdeSettings || user.additionalData?.ideSettings),
            workspaceConfig: JSON.stringify(workspace.config),
            user: {
                id: user.id,
                email: User.getPrimaryEmail(user),
            },
        };
        for (let attempt = 0; attempt < 15; attempt++) {
            if (attempt != 0) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            try {
                return await this.ideService.resolveWorkspaceConfig(req);
            } catch (e) {
                console.error("ide-service: failed to resolve workspace config: ", e);
            }
        }
        throw new Error("failed to resolve workspace IDE configuration");
    }
}
