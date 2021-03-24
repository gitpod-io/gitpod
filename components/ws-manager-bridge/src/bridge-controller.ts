/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable, interfaces } from "inversify";
import { WorkspaceManagerBridge, WorkspaceManagerBridgeFactory } from "./bridge";
import { Configuration } from "./config";
import { WorkspaceManagerClientProvider } from '@gitpod/ws-manager/lib/client-provider';
import { WorkspaceManagerClientProviderSource, WorkspaceManagerConnectionInfo } from '@gitpod/ws-manager/lib/client-provider-source';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { WorkspaceClusterDB } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { WorkspaceCluster } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { Queue } from "@gitpod/gitpod-protocol";

@injectable()
export class BridgeController {
    @inject(Configuration)
    protected readonly config: Configuration;

    @inject(WorkspaceManagerBridgeFactory)
    protected readonly bridgeFactory: interfaces.Factory<WorkspaceManagerBridge>;

    @inject(WorkspaceManagerClientProvider)
    protected readonly clientProvider: WorkspaceManagerClientProvider;

    @inject(WorkspaceClusterDB)
    protected readonly db: WorkspaceClusterDB;

    protected readonly bridges: Map<string, WorkspaceManagerBridge> = new Map();
    protected readonly reconcileQueue: Queue = new Queue();
    protected reconcileTimer: NodeJS.Timeout | undefined = undefined;

    public async start() {
        const scheduleReconcile = async () => {
            try {
                await this.reconcile();
            } catch (err) {
                log.error("error reconciling WorkspaceCluster", err);
            } finally {
                this.reconcileTimer = setTimeout(scheduleReconcile, this.config.wsClusterDBReconcileIntervalSeconds * 1000);
            }
        };
        await scheduleReconcile();
    }

    /**
     * Triggers a reconcile run
     */
    public async runReconcileNow() {
        await this.reconcile();
    }

    protected async reconcile() {
        return this.reconcileQueue.enqueue(async () => {
            const availableClusters = await this.gatherAvailableWorkspaceCluster();
            const toDelete: string[] = [];
            try {
                for (const [name, bridge] of this.bridges) {
                    let cluster = availableClusters.get(name);
                    if (!cluster) {
                        log.info("reconcile: cluster not present anymore, stopping", { name });
                        bridge.stop();
                        toDelete.push(name);
                    } else {
                        log.info("reconcile: cluster already present, doing nothing", { name });
                        availableClusters.delete(name);
                    }
                }
            } finally {
                for (const del of toDelete) {
                    this.bridges.delete(del);
                }
            }

            for (const [name, newCluster] of availableClusters) {
                log.info("reconcile: create bridge for new cluster", { name });
                const bridge = await this.createAndStartBridge(newCluster);
                this.bridges.set(newCluster.name, bridge);
            }
        });
    }

    protected async createAndStartBridge(cluster: WorkspaceCluster): Promise<WorkspaceManagerBridge> {
        const bridge = this.bridgeFactory() as WorkspaceManagerBridge;
        const clientProvider = async () => {
            const grpcOptions = {
                "grpc.keepalive_timeout_ms": 1500,
                "grpc.keepalive_time_ms": 1000,
                "grpc.keepalive_permit_without_calls": 1,
            };
            return this.clientProvider.get(cluster.name, grpcOptions);
        }
        bridge.start(cluster, clientProvider);
        return bridge;
    }

    protected async gatherAvailableWorkspaceCluster(): Promise<Map<string, WorkspaceCluster>> {
        const allClusters = await this.clientProvider.getAllAvailableWorkspaceClusters();
        const result: Map<string, WorkspaceCluster> = new Map();
        for (const cluster of allClusters) {
            result.set(cluster.name, cluster);
        }
        return result;
    }

    public async dispose() {
        await this.reconcileQueue.enqueue(async () => {
            // running in reconcileQueue to make sure we're not in the process of reconciling atm (and re-scheduling)
            if (this.reconcileTimer !== undefined) {
                clearTimeout(this.reconcileTimer);
                this.reconcileTimer = undefined;
            }
        });
        
        for (const [_, bridge] of this.bridges) {
            bridge.stop();
        }
    }
}

@injectable()
export class WorkspaceManagerClientProviderConfigSource implements WorkspaceManagerClientProviderSource {
    @inject(Configuration)
    protected readonly config: Configuration;

    public async getConnectionInfo(name: string): Promise<WorkspaceManagerConnectionInfo | undefined> {
        return this.clusters.find(m => m.name === name);
    }

    public async getAvailableWorkspaceClusters(): Promise<WorkspaceCluster[]> {
        return this.clusters.filter(c => c.state === "available");
    }

    protected get clusters(): WorkspaceCluster[] {
        return this.config.staticBridges;
    }
}