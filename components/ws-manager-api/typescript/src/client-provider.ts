/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as grpc from "grpc";
import { injectable, inject } from 'inversify';
import { WorkspaceManagerClient } from './core_grpc_pb';
import { PromisifiedWorkspaceManagerClient, linearBackoffStrategy } from "./promisified-client";
import { Disposable } from "@gitpod/gitpod-protocol";
import { WorkspaceClusterWoTls, WorkspaceManagerConnectionInfo } from '@gitpod/gitpod-protocol/lib/workspace-cluster';
import { WorkspaceManagerClientProviderCompositeSource, WorkspaceManagerClientProviderSource } from "./client-provider-source";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

@injectable()
export class WorkspaceManagerClientProvider implements Disposable {
    @inject(WorkspaceManagerClientProviderCompositeSource)
    protected readonly source: WorkspaceManagerClientProviderSource;

    // gRPC connections maintain their connectivity themselves, i.e. they reconnect when neccesary.
    // They can also be used concurrently, even across services.
    // Thus it makes sense to cache them rather than create a new connection for each request.
    protected readonly connectionCache = new Map<string, WorkspaceManagerClient>();

    /**
     * Throws an error if there is not WorkspaceManagerClient available.
     * 
     * @returns The WorkspaceManagerClient that was chosen to start the next workspace with.
     */
    public async getStartManager(): Promise<{ manager: PromisifiedWorkspaceManagerClient, installation: string}> {
        const allClusters = await this.source.getAllWorkspaceClusters();
        const availableClusters = allClusters.filter((c) => c.score >= 0 && c.govern && c.state === "available");
        const chosenCluster = chooseCluster(availableClusters);
        const client = await this.get(chosenCluster.name);
        return {
            manager: client,
            installation: chosenCluster.name,
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
        } else if(client.getChannel().getConnectivityState(true) != grpc.connectivityState.READY) {
            client.close();

            console.warn(`Lost connection to workspace manager \"${name}\" - attempting to reestablish`);
            const info = await getConnectionInfo();
            client = this.createClient(info, grpcOptions);
            this.connectionCache.set(name, client);
        }

        const stopSignal = { stop: false };
        return new PromisifiedWorkspaceManagerClient(client, linearBackoffStrategy(30, 1000, stopSignal), stopSignal);
    }

    /**
     * @returns All WorkspaceClusters (without TLS config)
     */
    public async getAllWorkspaceClusters(): Promise<WorkspaceClusterWoTls[]> {
        return this.source.getAllWorkspaceClusters();
    }

    public createClient(info: WorkspaceManagerConnectionInfo, grpcOptions?: object): WorkspaceManagerClient {
        let credentials: grpc.ChannelCredentials;
        if (info.tls) {
            const rootCerts = Buffer.from(info.tls.ca, "base64");
            const privateKey = Buffer.from(info.tls.key, "base64");
            const certChain = Buffer.from(info.tls.crt, "base64");
            credentials = grpc.credentials.createSsl(rootCerts, privateKey, certChain);
            log.debug("using TLS config to connect ws-manager");
        } else {
            credentials = grpc.credentials.createInsecure();
        }

        const options = {
            ...grpcOptions,
            'grpc.ssl_target_name_override': "ws-manager",  // this makes sure we can call ws-manager with a URL different to "ws-manager"
        };
        return new WorkspaceManagerClient(info.url, credentials, options);
    }

    public dispose() {
        Array.from(this.connectionCache.values()).map(c => c.close());
    }
}

/**
 * 
 * @param clusters 
 * @returns The chosen cluster. Throws an error if there are 0 WorkspaceClusters to choose from.
 */
function chooseCluster(availableCluster: WorkspaceClusterWoTls[]): WorkspaceClusterWoTls {
    if (availableCluster.length === 0) {
        throw new Error("No cluster to choose from!");
    }

    const scoreFunc = (c: WorkspaceClusterWoTls): number => {
        let score = c.score;    // here is the point where we may want to implement non-static approaches

        // clamp to maxScore
        if (score > c.maxScore) {
            score = c.maxScore;
        }
        return score;
    };

    const scoreSum = availableCluster
        .map(scoreFunc)
        .reduce((sum, cScore) => cScore + sum, 0);
    const pNormalized = availableCluster.map(c => scoreFunc(c) / scoreSum);
    const p = Math.random();
    let pSummed = 0;
    for (let i = 0; i < availableCluster.length; i++) {
        pSummed += pNormalized[i]
        if (p <= pSummed) {
            return availableCluster[i];
        }
    }
    return availableCluster[availableCluster.length - 1];
}