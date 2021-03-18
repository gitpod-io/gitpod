/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */
import { injectable, inject, multiInject } from 'inversify';
import { WorkspaceCluster, WorkspaceClusterDB } from '@gitpod/gitpod-protocol/lib/workspace-cluster';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

export const WorkspaceManagerClientProviderSource = Symbol("WorkspaceManagerClientProviderSource");

export interface WorkspaceManagerClientProviderSource {
    getConnectionInfo(name: string): Promise<WorkspaceManagerConnectionInfo | undefined>;
    getAvailableWorkspaceClusters(): Promise<WorkspaceCluster[]>;
}

export type WorkspaceManagerConnectionInfo = Pick<WorkspaceCluster, "url" | "certificate" | "token">;


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
        return JSON.parse(decoded) as WorkspaceCluster[];
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