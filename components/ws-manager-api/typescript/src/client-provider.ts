/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
    createClientCallMetricsInterceptor,
    IClientCallMetrics,
} from '@gitpod/content-service/lib/client-call-metrics';
import { Disposable, Workspace, WorkspaceInstance } from '@gitpod/gitpod-protocol';
import { defaultGRPCOptions } from '@gitpod/gitpod-protocol/lib/util/grpc';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { WorkspaceClusterWoTLS, WorkspaceManagerConnectionInfo } from '@gitpod/gitpod-protocol/lib/workspace-cluster';
import * as grpc from '@grpc/grpc-js';
import { inject, injectable, optional } from 'inversify';
import {
    WorkspaceManagerClientProviderCompositeSource,
    WorkspaceManagerClientProviderSource,
} from './client-provider-source';
import { ExtendedUser, workspaceClusterSetsAuthorized } from './constraints';
import { WorkspaceManagerClient } from './core_grpc_pb';
import { linearBackoffStrategy, PromisifiedWorkspaceManagerClient } from './promisified-client';

export const IWorkspaceManagerClientCallMetrics = Symbol('IWorkspaceManagerClientCallMetrics');

@injectable()
export class WorkspaceManagerClientProvider implements Disposable {
    @inject(WorkspaceManagerClientProviderCompositeSource)
    protected readonly source: WorkspaceManagerClientProviderSource;

    @inject(IWorkspaceManagerClientCallMetrics)
    @optional()
    protected readonly clientCallMetrics: IClientCallMetrics;

    // gRPC connections maintain their connectivity themselves, i.e. they reconnect when neccesary.
    // They can also be used concurrently, even across services.
    // Thus it makes sense to cache them rather than create a new connection for each request.
    protected readonly connectionCache = new Map<string, WorkspaceManagerClient>();

    /**
     * getStartClusterSets produces a set of workspace clusters we can try to start a workspace in.
     * If starting a workspace fails in one cluster, the caller is expected to "pop" another cluster
     * of the list until the workspace start has succeeded or pop returns undefined.
     *
     * @param user user who wants to starts a workspace manager
     * @param workspace the workspace we want to start
     * @param instance the instance we want to start
     * @returns a set of workspace clusters we can start the workspace in
     */
    public async getStartClusterSets(
        user: ExtendedUser,
        workspace: Workspace,
        instance: WorkspaceInstance,
    ): Promise<IWorkspaceClusterStartSet> {
        const allClusters = await this.source.getAllWorkspaceClusters();
        const availableClusters = allClusters.filter((c) => c.score > 0 && c.state === 'available');

        const sets = workspaceClusterSetsAuthorized
            .map((constraints) => {
                const r = constraints.constraint(availableClusters, user, workspace, instance);
                if (!r) {
                    return;
                }
                return new ClusterSet(this, r);
            })
            .filter((s) => s !== undefined) as ClusterSet[];

        return {
            [Symbol.asyncIterator]: (): AsyncIterator<ClusterClientEntry> => {
                return {
                    next: async (): Promise<IteratorResult<ClusterClientEntry>> => {
                        while (true) {
                            if (sets.length === 0) {
                                return { done: true, value: undefined };
                            }

                            let res = await sets[0].next();
                            if (!!res.done) {
                                sets.splice(0, 1);
                                continue;
                            }

                            return res;
                        }
                    },
                };
            },
        };
    }

    /**
     * @param name
     * @returns The WorkspaceManagerClient identified by the name. Throws an error if there is none.
     */
    public async get(name: string, grpcOptions?: object): Promise<PromisifiedWorkspaceManagerClient> {
        const getConnectionInfo = async () => {
            const cluster = await this.source.getWorkspaceCluster(name);
            if (!cluster) {
                throw new Error(`Unknown workspace manager \"${name}\"`);
            }
            return cluster;
        };

        let client = this.connectionCache.get(name);
        if (!client) {
            const info = await getConnectionInfo();
            client = this.createClient(info, grpcOptions);
            this.connectionCache.set(name, client);
        } else if (client.getChannel().getConnectivityState(true) != grpc.connectivityState.READY) {
            client.close();

            console.warn(`Lost connection to workspace manager \"${name}\" - attempting to reestablish`);
            const info = await getConnectionInfo();
            client = this.createClient(info, grpcOptions);
            this.connectionCache.set(name, client);
        }

        let interceptor: grpc.Interceptor[] = [];
        if (this.clientCallMetrics) {
            interceptor = [createClientCallMetricsInterceptor(this.clientCallMetrics)];
        }

        const stopSignal = { stop: false };
        return new PromisifiedWorkspaceManagerClient(
            client,
            linearBackoffStrategy(30, 1000, stopSignal),
            interceptor,
            stopSignal,
        );
    }

    /**
     * @returns All WorkspaceClusters (without TLS config)
     */
    public async getAllWorkspaceClusters(): Promise<WorkspaceClusterWoTLS[]> {
        return this.source.getAllWorkspaceClusters();
    }

    public createClient(info: WorkspaceManagerConnectionInfo, grpcOptions?: object): WorkspaceManagerClient {
        let credentials: grpc.ChannelCredentials;
        if (info.tls) {
            const rootCerts = Buffer.from(info.tls.ca, 'base64');
            const privateKey = Buffer.from(info.tls.key, 'base64');
            const certChain = Buffer.from(info.tls.crt, 'base64');
            credentials = grpc.credentials.createSsl(rootCerts, privateKey, certChain);
            log.debug('using TLS config to connect ws-manager');
        } else {
            credentials = grpc.credentials.createInsecure();
        }

        const options: Partial<grpc.ClientOptions> = {
            ...grpcOptions,
            'grpc.ssl_target_name_override': 'ws-manager', // this makes sure we can call ws-manager with a URL different to "ws-manager"
        };
        return new WorkspaceManagerClient(info.url, credentials, options);
    }

    public dispose() {
        Array.from(this.connectionCache.values()).map((c) => c.close());
    }
}

export interface IWorkspaceClusterStartSet extends AsyncIterable<ClusterClientEntry> {}

export interface ClusterClientEntry {
    manager: PromisifiedWorkspaceManagerClient;
    installation: string;
}

/**
 * ClusterSet is an iterator
 */
class ClusterSet implements AsyncIterator<ClusterClientEntry> {
    protected usedCluster: string[] = [];
    constructor(
        protected readonly provider: WorkspaceManagerClientProvider,
        protected readonly cluster: WorkspaceClusterWoTLS[],
    ) {}

    public async next(): Promise<IteratorResult<ClusterClientEntry>> {
        const available = this.cluster.filter((c) => !this.usedCluster.includes(c.name));
        const chosenCluster = chooseCluster(available);
        if (!chosenCluster) {
            // empty set
            return { done: true, value: undefined };
        }
        this.usedCluster.push(chosenCluster.name);

        const grpcOptions: grpc.ClientOptions = {
            ...defaultGRPCOptions,
        };
        const client = await this.provider.get(chosenCluster.name, grpcOptions);
        return {
            done: false,
            value: {
                manager: client,
                installation: chosenCluster.name,
            },
        };
    }
}

/**
 *
 * @param clusters
 * @returns The chosen cluster. Throws an error if there are 0 WorkspaceClusters to choose from.
 */
function chooseCluster(availableCluster: WorkspaceClusterWoTLS[]): WorkspaceClusterWoTLS {
    const scoreFunc = (c: WorkspaceClusterWoTLS): number => {
        let score = c.score; // here is the point where we may want to implement non-static approaches

        // clamp to maxScore
        if (score > c.maxScore) {
            score = c.maxScore;
        }
        return score;
    };

    const scoreSum = availableCluster.map(scoreFunc).reduce((sum, cScore) => cScore + sum, 0);
    const pNormalized = availableCluster.map((c) => scoreFunc(c) / scoreSum);
    const p = Math.random();
    let pSummed = 0;
    for (let i = 0; i < availableCluster.length; i++) {
        pSummed += pNormalized[i];
        if (p <= pSummed) {
            return availableCluster[i];
        }
    }
    return availableCluster[availableCluster.length - 1];
}
