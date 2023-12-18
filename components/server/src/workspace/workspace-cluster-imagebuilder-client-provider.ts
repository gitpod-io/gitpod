/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User, Workspace, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { defaultGRPCOptions } from "@gitpod/gitpod-protocol/lib/util/grpc";
import { WorkspaceRegion } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import {
    ImageBuilderClient,
    ImageBuilderClientProvider,
    PromisifiedImageBuilderClient,
} from "@gitpod/image-builder/lib";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import {
    WorkspaceManagerClientProviderCompositeSource,
    WorkspaceManagerClientProviderSource,
} from "@gitpod/ws-manager/lib/client-provider-source";
import { inject, injectable } from "inversify";

@injectable()
export class WorkspaceClusterImagebuilderClientProvider implements ImageBuilderClientProvider {
    @inject(WorkspaceManagerClientProviderCompositeSource)
    protected readonly source: WorkspaceManagerClientProviderSource;
    @inject(WorkspaceManagerClientProvider) protected readonly clientProvider: WorkspaceManagerClientProvider;

    // gRPC connections can be used concurrently, even across services.
    // Thus it makes sense to cache them rather than create a new connection for each request.
    protected readonly connectionCache = new Map<string, ImageBuilderClient>();

    async getClient(
        user: User,
        workspace?: Workspace,
        instance?: WorkspaceInstance,
        region?: WorkspaceRegion,
        constrainWorkspaceClassSupport?: boolean,
    ): Promise<PromisifiedImageBuilderClient> {
        const clusters = await this.clientProvider.getStartClusterSets(
            user,
            workspace,
            instance,
            region,
            constrainWorkspaceClassSupport,
        );
        for await (const cluster of clusters) {
            const info = await this.source.getWorkspaceCluster(cluster.installation);
            if (!info) {
                continue;
            }

            let client = this.connectionCache.get(info.name);
            if (!client) {
                client = this.clientProvider.createConnection(ImageBuilderClient, info, defaultGRPCOptions);
                this.connectionCache.set(info.name, client);
            }
            return new PromisifiedImageBuilderClient(client, []);
        }

        throw new Error("no image-builder available");
    }
}
