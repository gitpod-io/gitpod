/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Queue } from '@gitpod/gitpod-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { WorkspaceCluster, WorkspaceClusterDB, WorkspaceClusterState, TLSConfig } from '@gitpod/gitpod-protocol/lib/workspace-cluster';
import {
    ClusterServiceService,
    ClusterState,
    ClusterStatus,
    DeregisterRequest,
    DeregisterResponse,
    IClusterServiceServer,
    ListRequest,
    ListResponse,
    Preferability,
    RegisterRequest,
    RegisterResponse,
    UpdateRequest,
    UpdateResponse
} from '@gitpod/ws-manager-bridge-api/lib';
import { GetWorkspacesRequest } from '@gitpod/ws-manager/lib';
import { WorkspaceManagerClientProvider } from '@gitpod/ws-manager/lib/client-provider';
import * as grpc from "grpc";
import { inject, injectable } from 'inversify';
import { BridgeController } from './bridge-controller';
import { Configuration } from './config';

export interface ClusterServiceServerOptions {
    port: number;
    host: string;
}

@injectable()
export class ClusterService implements IClusterServiceServer {
    @inject(Configuration)
    protected readonly config: Configuration;

    @inject(WorkspaceClusterDB)
    protected readonly db: WorkspaceClusterDB;

    @inject(BridgeController)
    protected readonly bridgeController: BridgeController;

    @inject(WorkspaceManagerClientProvider)
    protected readonly clientProvider: WorkspaceManagerClientProvider;

    // using a queue to make sure we do concurrency right
    protected readonly queue: Queue = new Queue();

    public register(call: grpc.ServerUnaryCall<RegisterRequest>, callback: grpc.sendUnaryData<RegisterResponse>) {
        this.queue.enqueue(async () => {
            try {
                // check if the name or URL are already registered/in use
                const req = call.request.toObject();
                await Promise.all([
                    async () => {
                        const oldCluster = await this.db.findByName(req.name);
                        if (!oldCluster) {
                            throw new GRPCError(grpc.status.ALREADY_EXISTS, `a WorkspaceCluster with name ${req.name} already exists in the DB`);
                        }
                    },
                    async () => {
                        const oldCluster = await this.db.findFiltered({ url: req.url });
                        if (!oldCluster) {
                            throw new GRPCError(grpc.status.ALREADY_EXISTS, `a WorkspaceCluster with url ${req.url} already exists in the DB`);
                        }
                    }
                ]);

                // store the ws-manager into the database
                let perfereability = Preferability.NONE;
                let govern = false;
                let state: WorkspaceClusterState = "available";
                if (req.hints) {
                    perfereability = req.hints.perfereability;
                    if (req.hints.govern) {
                        govern = req.hints.govern;
                    }
                    state = mapCordoned(req.hints.cordoned);
                }
                let score = mapPreferabilityToScore(perfereability);
                if (score === undefined) {
                    throw new GRPCError(grpc.status.INVALID_ARGUMENT, `unknown preferability ${perfereability}`);
                }

                if (!req.tls) {
                    throw new GRPCError(grpc.status.INVALID_ARGUMENT, "missing required TLS config");
                }
                // we assume that client's have already base64-encoded their input!
                const tls: TLSConfig = {
                    ca: req.tls.ca,
                    crt: req.tls.crt,
                    key: req.tls.key
                };

                const newCluster: WorkspaceCluster = {
                    name: req.name,
                    url: req.url,
                    state,
                    score,
                    maxScore: 100,
                    govern,
                    tls,
                };

                // try to connect to validate the config. Throws an exception if it fails.
                await new Promise<void>((resolve, reject) => {
                    const c = this.clientProvider.createClient(newCluster);
                    c.getWorkspaces(new GetWorkspacesRequest(), (err, resp) => {
                        if (err) {
                            reject(new GRPCError(grpc.status.FAILED_PRECONDITION, `cannot reach ${req.url}: ${err.message}`));
                        } else {
                            resolve();
                        }
                    });
                })

                await this.db.save(newCluster);

                this.triggerReconcile("register", req.name);

                callback(null, new RegisterResponse());
            } catch (err) {
                callback(mapToGRPCError(err), null);
            }
        });
    }

    public update(call: grpc.ServerUnaryCall<UpdateRequest>, callback: grpc.sendUnaryData<UpdateResponse>) {
        this.queue.enqueue(async () => {
            try {
                const req = call.request.toObject();
                const cluster = await this.db.findByName(req.name);
                if (!cluster) {
                    throw new GRPCError(grpc.status.ALREADY_EXISTS, `a WorkspaceCluster with name ${req.name} already exists in the DB!`);
                }

                if (call.request.hasMaxScore()) {
                    cluster.maxScore = req.maxScore;
                }
                if (call.request.hasScore()) {
                    cluster.score = req.score;
                }
                if (call.request.hasCordoned()) {
                    cluster.state = mapCordoned(req.cordoned);
                }
                await this.db.save(cluster);

                this.triggerReconcile("update", req.name);

                callback(null, new UpdateResponse());
            } catch (err) {
                callback(mapToGRPCError(err), null);
            }
        });
    }

    public deregister(call: grpc.ServerUnaryCall<DeregisterRequest>, callback: grpc.sendUnaryData<DeregisterResponse>) {
        this.queue.enqueue(async () => {
            try {
                const req = call.request.toObject();
                await this.db.deleteByName(req.name);

                this.triggerReconcile("deregister", req.name);

                callback(null, new DeregisterResponse());
            } catch (err) {
                callback(mapToGRPCError(err), null);
            }
        });
    }

    public list(call: grpc.ServerUnaryCall<ListRequest>, callback: grpc.sendUnaryData<ListResponse>) {
        this.queue.enqueue(async () => {
            try {
                const allClusters = await this.db.findFiltered({})

                const response = new ListResponse();
                for (const cluster of allClusters) {
                    const clusterStatus = new ClusterStatus();
                    clusterStatus.setName(cluster.name);
                    clusterStatus.setUrl(cluster.url);
                    clusterStatus.setState(mapClusterState(cluster.state));
                    clusterStatus.setScore(cluster.score);
                    clusterStatus.setMaxScore(cluster.maxScore);
                    clusterStatus.setGoverned(cluster.govern);
                    response.addStatus(clusterStatus);
                }

                callback(null, response);
            } catch (err) {
                callback(mapToGRPCError(err), null);
            }
        });
    }

    protected triggerReconcile(action: string, name: string) {
        const payload = { action, name };
        log.info("reconcile: on request", payload);
        this.bridgeController.runReconcileNow()
            .catch(err => log.error("error during forced reconcile", err, payload));
    }
}

function mapPreferabilityToScore(p: Preferability): number | undefined {
    switch (p) {
        case Preferability.PREFER:       return 100;
        case Preferability.NONE:         return 50;
        case Preferability.DONTSCHEDULE: return 0;
        default:                         return undefined;
    }
}

function mapCordoned(cordoned: boolean): WorkspaceClusterState {
    return cordoned ? "cordoned" : "available";
}

function mapClusterState(state: WorkspaceClusterState): ClusterState {
    switch (state) {
        case 'available': return ClusterState.AVAILABLE;
        case 'cordoned': return ClusterState.CORDONED;
        case 'draining': return ClusterState.DRAINING;
    }
}

function mapToGRPCError(err: any): any {
    if (!GRPCError.isGRPCError(err)) {
        return new GRPCError(grpc.status.INTERNAL, err);
    }
    return err;
}

// "grpc" does not allow additional methods on it's "ServiceServer"s so we have an additional wrapper here
@injectable()
export class ClusterServiceServer {
    @inject(Configuration)
    protected readonly config: Configuration;

    @inject(ClusterService)
    protected readonly service: ClusterService;

    protected server: grpc.Server | undefined = undefined;

    public async start() {
        const server = new grpc.Server();
        server.addService(ClusterServiceService, this.service);
        this.server = server;

        const bindTo = `${this.config.clusterService.host}:${this.config.clusterService.port}`;
        const port = server.bind(bindTo, grpc.ServerCredentials.createInsecure());
        if (port === 0) {
            throw new Error(`binding gRPC server to '${bindTo}' failed`);
        }
        
        server.start();
        log.info(`gRPC server listening on: ${bindTo}`);
    }

    public async stop() {
        const server = this.server;
        if (server !== undefined) {
            await new Promise((resolve) => {
                server.tryShutdown(() => resolve({}));
            });
            this.server = undefined;
        }
    }

}

class GRPCError extends Error implements grpc.ServiceError {
    details: string;

    constructor(
        public readonly status: grpc.status,
        err: any) {
        super(GRPCError.errToMessage(err));

        this.details = this.message;
    }

    static errToMessage(err: any): string | undefined {
        if (typeof err === "string") {
            return err;
        } else if (typeof err === "object") {
            return err.message;
        }
    }

    static isGRPCError(obj: any): obj is GRPCError {
        return obj !== undefined
            && typeof obj === "object"
            && "status" in obj;
    }
}