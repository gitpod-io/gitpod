/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { WorkspaceCluster, WorkspaceClusterDB } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import { inject, injectable } from "inversify";
import { Configuration } from "./config";
import { Client } from "@gitpod/gitpod-protocol/lib/experiments/types";
import {
    DescribeClusterRequest,
    DescribeClusterResponse,
    WorkspaceClass,
    WorkspaceManagerClient,
} from "@gitpod/ws-manager/lib";
import { AdmissionConstraintHasClass } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { GRPCError } from "./rpc";
import * as grpc from "@grpc/grpc-js";
import { defaultGRPCOptions } from "@gitpod/gitpod-protocol/lib/util/grpc";

@injectable()
export class ClusterSyncService {
    @inject(Configuration)
    protected readonly config: Configuration;

    @inject(WorkspaceClusterDB)
    protected readonly clusterDB: WorkspaceClusterDB;

    @inject(WorkspaceManagerClientProvider)
    protected readonly clientProvider: WorkspaceManagerClientProvider;

    @inject(Client)
    protected readonly featureClient: Client;

    protected timer: NodeJS.Timer;

    public start() {
        this.timer = setInterval(() => this.reconcile(), this.config.clusterSyncIntervalSeconds * 1000);
    }

    private async reconcile() {
        const enabled = await this.featureClient.getValueAsync("workspace_classes_backend", false, {});
        if (!enabled) {
            return;
        }

        log.debug("reconciling workspace classes...");
        let allClusters = await this.clusterDB.findFiltered({ applicationCluster: this.config.installation });
        for (const cluster of allClusters) {
            try {
                let supportedClasses = await getSupportedWorkspaceClasses(
                    this.clientProvider,
                    cluster,
                    this.config.installation,
                    true,
                );
                let existingOtherConstraints = cluster.admissionConstraints?.filter((c) => c.type !== "has-class");
                cluster.admissionConstraints = existingOtherConstraints?.concat(supportedClasses);
                await this.clusterDB.save(cluster);
            } catch (err) {
                log.error("failed to reconcile workspace classes for cluster", err, { cluster: cluster.name });
            }
        }
        log.debug("done reconciling workspace classes");
    }

    public stop() {
        clearInterval(this.timer);
    }
}

export async function getSupportedWorkspaceClasses(
    clientProvider: WorkspaceManagerClientProvider,
    cluster: WorkspaceCluster,
    applicationCluster: string,
    useCache: boolean,
) {
    let constraints = await new Promise<AdmissionConstraintHasClass[]>(async (resolve, reject) => {
        const grpcOptions: grpc.ClientOptions = {
            ...defaultGRPCOptions,
        };
        let client = useCache
            ? await (
                  await clientProvider.get(cluster.name, applicationCluster, grpcOptions)
              ).client
            : clientProvider.createConnection(WorkspaceManagerClient, cluster, grpcOptions);

        client.describeCluster(new DescribeClusterRequest(), (err: any, resp: DescribeClusterResponse) => {
            if (err) {
                reject(new GRPCError(grpc.status.FAILED_PRECONDITION, `cannot reach ${cluster.url}: ${err.message}`));
            } else {
                let classes = resp.getWorkspaceclassesList().map((cl) => mapWorkspaceClass(cl));
                resolve(classes);
            }
        });
    });

    return constraints;
}

function mapWorkspaceClass(c: WorkspaceClass): AdmissionConstraintHasClass {
    return <AdmissionConstraintHasClass>{ type: "has-class", id: c.getId(), displayName: c.getDisplayname() };
}
