/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */
import { injectable, inject, multiInject } from 'inversify';
import { TLSConfig, WorkspaceCluster, WorkspaceClusterDB } from '@gitpod/gitpod-protocol/lib/workspace-cluster';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { Queue } from '@gitpod/gitpod-protocol';

export const WorkspaceManagerClientProviderSource = Symbol("WorkspaceManagerClientProviderSource");

export interface WorkspaceManagerClientProviderSource {
    getConnectionInfo(name: string): Promise<WorkspaceManagerConnectionInfo | undefined>;
    getAvailableWorkspaceClusters(): Promise<WorkspaceCluster[]>;
}

export type WorkspaceManagerConnectionInfo = Pick<WorkspaceCluster, "url" | "tls">;


@injectable()
export class WorkspaceManagerClientProviderEnvSource implements WorkspaceManagerClientProviderSource {
    protected _clusters: WorkspaceCluster[] | undefined = undefined;

    public async getConnectionInfo(name: string): Promise<WorkspaceManagerConnectionInfo | undefined> {
        return this.clusters.find(m => m.name === name);
    }

    public async getAvailableWorkspaceClusters(): Promise<WorkspaceCluster[]> {
        return this.clusters.filter(c => c.state === "available");
    }

    protected get clusters(): WorkspaceCluster[] {
        if (this._clusters === undefined) {
            this._clusters = this.loadConfigFromEnv();
        }
        return this._clusters;
    }

    protected loadConfigFromEnv(): WorkspaceCluster[] {
        const configEncoded = process.env.WSMAN_CFG_MANAGERS;
        if (!configEncoded) {
            throw new Error("WSMAN_CFG_MANAGERS not set!");
        }

        const decoded = Buffer.from(configEncoded, 'base64').toString();
        const clusters = JSON.parse(decoded) as WorkspaceCluster[];
        return clusters.map(c => {
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

@injectable()
export class WorkspaceManagerClientProviderDBSource implements WorkspaceManagerClientProviderSource {
    @inject(WorkspaceClusterDB)
    protected readonly db: WorkspaceClusterDB;

    public async getConnectionInfo(name: string): Promise<WorkspaceManagerConnectionInfo | undefined> {
        return await this.db.findByName(name);
    }

    public async getAvailableWorkspaceClusters(): Promise<WorkspaceCluster[]> {
        return await this.db.findFiltered({ state: "available" });
    }
}

@injectable()
export class WorkspaceManagerClientProviderCompositeSource implements WorkspaceManagerClientProviderSource {
    @multiInject(WorkspaceManagerClientProviderSource)
    protected readonly sources: WorkspaceManagerClientProviderSource[];

    async getConnectionInfo(name: string): Promise<WorkspaceManagerConnectionInfo | undefined> {
        for (const source of this.sources) {
            const info = await source.getConnectionInfo(name);
            if (info !== undefined) {
                return info;
            }
        }
        return undefined;
    }

    async getAvailableWorkspaceClusters(): Promise<WorkspaceCluster[]> {
        const allClusters: Map<string, WorkspaceCluster> = new Map();
        for (const source of this.sources) {
            const clusters = await source.getAvailableWorkspaceClusters();
            for (const cluster of clusters) {
                if (allClusters.has(cluster.name)) {
                    log.warn(`${cluster.name} is specified multiple times, overriding with: \n${JSON.stringify(cluster)}`);
                }
                allClusters.set(cluster.name, cluster);
            }
        }
        const result: WorkspaceCluster[] = [];
        for (const [_, cluster] of allClusters) {
            result.push(cluster);
        }
        return result;
    }
}

export class WorkspaceManagerClientProviderCachingSource implements WorkspaceManagerClientProviderSource {

    protected cache: Map<string, WorkspaceCluster> = new Map();
    protected readonly queue: Queue = new Queue();
    protected reconcileTimer: NodeJS.Timeout | undefined = undefined;

    constructor(protected readonly source: WorkspaceManagerClientProviderSource) {
        const scheduleReconcile = async () => {
            try {
                await this.reconcile();
            } catch (err) {
                log.error("error reconciling WorkspaceManagerClientProviderCachingSource", err);
            } finally {
                this.reconcileTimer = setTimeout(scheduleReconcile, 30 * 1000);
            }
        };
        scheduleReconcile();
    }

    protected async reconcile() {
        return this.queue.enqueue(async () => {
            this.cache.clear();

            const allClusters = await this.getAvailableWorkspaceClusters();
            for (const cluster of allClusters) {
                this.cache.set(cluster.name, cluster);
            }
        });
    }

    async getConnectionInfo(name: string): Promise<WorkspaceManagerConnectionInfo | undefined> {
        return this.queue.enqueue(async () => this.cache.get(name));
    }

    async getAvailableWorkspaceClusters(): Promise<WorkspaceCluster[]> {
        return this.queue.enqueue(async () => {
            const result: WorkspaceCluster[] = [];
            for (const [_, cluster] of this.cache) {
                result.push(cluster);
            }
            return result;
        });
    }
}