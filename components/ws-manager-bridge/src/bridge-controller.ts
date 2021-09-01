/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable, interfaces } from "inversify";
import { WorkspaceClusterInfo, WorkspaceManagerBridge, WorkspaceManagerBridgeFactory } from "./bridge";
import { Configuration } from "./config";
import { WorkspaceManagerClientProvider } from '@gitpod/ws-manager/lib/client-provider';
import { WorkspaceManagerClientProviderSource } from '@gitpod/ws-manager/lib/client-provider-source';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { TLSConfig, WorkspaceClusterDB, WorkspaceClusterWoTLS } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { WorkspaceCluster } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { Queue } from "@gitpod/gitpod-protocol";
import { defaultGRPCOptions } from '@gitpod/gitpod-protocol/lib/util/grpc';
import * as grpc from '@grpc/grpc-js';

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
            const allClusters = await this.getAllWorkspaceClusters();
            const toDelete: string[] = [];
            try {
                for (const [name, bridge] of this.bridges) {
                    let cluster = allClusters.get(name);
                    if (!cluster) {
                        log.info("reconcile: cluster not present anymore, stopping", { name });
                        bridge.stop();
                        toDelete.push(name);
                    } else {
                        log.info("reconcile: cluster already present, doing nothing", { name });
                        allClusters.delete(name);
                    }
                }
            } finally {
                for (const del of toDelete) {
                    this.bridges.delete(del);
                }
            }

            for (const [name, newCluster] of allClusters) {
                log.info("reconcile: create bridge for new cluster", { name });
                const bridge = await this.createAndStartBridge(newCluster);
                this.bridges.set(newCluster.name, bridge);
            }
        });
    }

    protected async createAndStartBridge(cluster: WorkspaceClusterInfo): Promise<WorkspaceManagerBridge> {
        const bridge = this.bridgeFactory() as WorkspaceManagerBridge;
        const grpcOptions: grpc.ClientOptions = {
            ...defaultGRPCOptions,
        };
        const clientProvider = async () => {
            return this.clientProvider.get(cluster.name, grpcOptions);
        }
        bridge.start(cluster, clientProvider);
        return bridge;
    }

    protected async getAllWorkspaceClusters(): Promise<Map<string, WorkspaceClusterWoTLS>> {
        const allInfos = await this.clientProvider.getAllWorkspaceClusters();
        const result: Map<string, WorkspaceClusterWoTLS> = new Map();
        for (const cluster of allInfos) {
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

    public async getWorkspaceCluster(name: string): Promise<WorkspaceCluster | undefined> {
        return this.clusters.find(m => m.name === name);
    }

    public async getAllWorkspaceClusters(): Promise<WorkspaceClusterWoTLS[]> {
        return this.clusters;
    }

    protected get clusters(): WorkspaceCluster[] {
        return this.config.staticBridges.map(c => {
            if (!c.tls) {
                return c;
            }

            return {
                ...c,
                tls: {
                    ca: TLSConfig.loadFromBase64File(c.tls.ca),
                    crt: TLSConfig.loadFromBase64File(c.tls.crt),
                    key: TLSConfig.loadFromBase64File(c.tls.key),
                }
            }
        });
    }
}