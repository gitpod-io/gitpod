/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Workspace, User, WorkspaceInstance, NamedWorkspaceFeatureFlag } from "@gitpod/gitpod-protocol";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { injectable } from "inversify";
import { IDEConfig } from "../../../src/ide-config";
import { WorkspaceStarter } from "../../../src/workspace/workspace-starter";

@injectable()
export class WorkspaceStarterEE extends WorkspaceStarter {
    /**
     * Creates a new instance for a given workspace and its owner
     *
     * @param workspace the workspace to create an instance for
     */
    protected async newInstance(
        ctx: TraceContext,
        workspace: Workspace,
        previousInstance: WorkspaceInstance | undefined,
        user: User,
        excludeFeatureFlags: NamedWorkspaceFeatureFlag[],
        ideConfig: IDEConfig,
    ): Promise<WorkspaceInstance> {
        const instance = await super.newInstance(
            ctx,
            workspace,
            previousInstance,
            user,
            excludeFeatureFlags,
            ideConfig,
        );

        return instance;
    }
}
