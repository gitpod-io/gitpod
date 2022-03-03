/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */
import { injectable, inject, multiInject } from 'inversify';
import {
    TLSConfig,
    WorkspaceCluster,
    WorkspaceClusterDB,
    WorkspaceClusterWoTLS,
} from '@gitpod/gitpod-protocol/lib/workspace-cluster';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

export const WorkspaceManagerClientProviderSource = Symbol('WorkspaceManagerClientProviderSource');

export interface WorkspaceManagerClientProviderSource {
    getWorkspaceCluster(name: string): Promise<WorkspaceCluster | undefined>;
    getAllWorkspaceClusters(): Promise<WorkspaceClusterWoTLS[]>;
}

@injectable()
export class WorkspaceManagerClientProviderEnvSource implements WorkspaceManagerClientProviderSource {
    protected _clusters: WorkspaceCluster[] | undefined = undefined;

    public async getWorkspaceCluster(name: string): Promise<WorkspaceCluster | undefined> {
        return this.clusters.find((m) => m.name === name);
    }

    public async getAllWorkspaceClusters(): Promise<WorkspaceClusterWoTLS[]> {
        return this.clusters;
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
            throw new Error('WSMAN_CFG_MANAGERS not set!');
        }

        const decoded = Buffer.from(configEncoded, 'base64').toString();
        const clusters = JSON.parse(decoded) as WorkspaceCluster[];
        return clusters.map((c) => {
            if (!c.tls) {
                return c;
            }

            return {
                ...c,
                tls: {
                    ca: TLSConfig.loadFromBase64File(c.tls.ca),
                    crt: TLSConfig.loadFromBase64File(c.tls.crt),
                    key: TLSConfig.loadFromBase64File(c.tls.key),
                },
            };
        });
    }
}

@injectable()
export class WorkspaceManagerClientProviderDBSource implements WorkspaceManagerClientProviderSource {
    @inject(WorkspaceClusterDB)
    protected readonly db: WorkspaceClusterDB;

    public async getWorkspaceCluster(name: string): Promise<WorkspaceCluster | undefined> {
        return await this.db.findByName(name);
    }

    public async getAllWorkspaceClusters(): Promise<WorkspaceClusterWoTLS[]> {
        return await this.db.findFiltered({});
    }
}

@injectable()
export class WorkspaceManagerClientProviderCompositeSource implements WorkspaceManagerClientProviderSource {
    @multiInject(WorkspaceManagerClientProviderSource)
    protected readonly sources: WorkspaceManagerClientProviderSource[];

    async getWorkspaceCluster(name: string): Promise<WorkspaceCluster | undefined> {
        for (const source of this.sources) {
            const info = await source.getWorkspaceCluster(name);
            if (info !== undefined) {
                return info;
            }
        }
        return undefined;
    }

    async getAllWorkspaceClusters(): Promise<WorkspaceClusterWoTLS[]> {
        const allClusters: Map<string, WorkspaceClusterWoTLS> = new Map();
        for (const source of this.sources) {
            const clusters = await source.getAllWorkspaceClusters();
            for (const cluster of clusters) {
                if (allClusters.has(cluster.name)) {
                    log.warn(
                        `${cluster.name} is specified multiple times, overriding with: \n${JSON.stringify(cluster)}`,
                    );
                }
                allClusters.set(cluster.name, cluster);
            }
        }
        const result: WorkspaceClusterWoTLS[] = [];
        for (const [_, cluster] of allClusters) {
            result.push(cluster);
        }
        return result;
    }
}
