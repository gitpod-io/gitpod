/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import {
    Workspace,
    User,
    WorkspaceInstance,
    WorkspaceInstanceConfiguration,
    NamedWorkspaceFeatureFlag,
} from "@gitpod/gitpod-protocol";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { inject, injectable } from "inversify";
import { IDEConfig } from "../../../src/ide-config";
import { WorkspaceStarter } from "../../../src/workspace/workspace-starter";
import { EligibilityService } from "../user/eligibility-service";

@injectable()
export class WorkspaceStarterEE extends WorkspaceStarter {
    @inject(EligibilityService) protected readonly eligibilityService: EligibilityService;

    /**
     * Creates a new instance for a given workspace and its owner
     *
     * @param workspace the workspace to create an instance for
     */
    protected async newInstance(
        ctx: TraceContext,
        workspace: Workspace,
        user: User,
        excludeFeatureFlags: NamedWorkspaceFeatureFlag[],
        ideConfig: IDEConfig,
        forcePVC: boolean,
    ): Promise<WorkspaceInstance> {
        const instance = await super.newInstance(ctx, workspace, user, excludeFeatureFlags, ideConfig, forcePVC);
        if (await this.eligibilityService.hasFixedWorkspaceResources(user)) {
            const config: WorkspaceInstanceConfiguration = instance.configuration!;
            const ff = config.featureFlags || [];
            ff.push("fixed_resources");
            config.featureFlags = ff;
            instance.configuration = config;
        }

        return instance;
    }
}
