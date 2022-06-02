/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { WorkspaceStatus } from "@gitpod/ws-manager/lib";
import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { injectable } from "inversify";

export const PrebuildUpdater = Symbol("PrebuildUpdater");

export interface PrebuildUpdater {
    updatePrebuiltWorkspace(
        ctx: TraceContext,
        userId: string,
        status: WorkspaceStatus.AsObject,
        writeToDB: boolean,
    ): Promise<void>;

    stopPrebuildInstance(ctx: TraceContext, instance: WorkspaceInstance): Promise<void>;
}

@injectable()
export class PrebuildUpdaterNoOp implements PrebuildUpdater {
    async updatePrebuiltWorkspace(
        ctx: TraceContext,
        userId: string,
        status: WorkspaceStatus.AsObject,
        writeToDB: boolean,
    ): Promise<void> {}

    async stopPrebuildInstance(ctx: TraceContext, instance: WorkspaceInstance): Promise<void> {}
}
