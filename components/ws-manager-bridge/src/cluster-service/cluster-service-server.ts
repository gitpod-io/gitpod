/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Queue } from '@gitpod/gitpod-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { WorkspaceCluster, WorkspaceClusterDB, WorkspaceClusterState } from '@gitpod/gitpod-protocol/lib/workspace-cluster';
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
import * as grpc from "grpc";
import { inject, injectable } from 'inversify';
import { BridgeController } from '../bridge-controller';
import { Configuration } from '../config';

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

    // using a queue to make sure we're not
    protected readonly queue: Queue = new Queue();

    public register(call: grpc.ServerUnaryCall<RegisterRequest>, callback: grpc.sendUnaryData<RegisterResponse>) {
        this.queue.enqueue(async () => {
            try {
                // 2. ws-manager-bridge checks if the name or URL are already registered/in use
                const req = call.request.toObject();
                await Promise.all([
                    async () => {
                        const oldCluster = await this.db.findByName(req.name);
                        if (!oldCluster) {
                            throw new GRPCError(grpc.status.ALREADY_EXISTS, `a WorkspaceCluster with name ${req.name} already exists in the DB!`);
                        }
                    },
                    async () => {
                        const oldCluster = await this.db.findFiltered({ url: req.url });
                        if (!oldCluster) {
                            throw new GRPCError(grpc.status.ALREADY_EXISTS, `a WorkspaceCluster with url ${req.url} already exists in the DB!`);
                        }
                    }
                ]);

                // 3. ws-manager-bridge attempts to connect back to ws-manager


                // 4. If that connection succeeds, ws-manager-bridge enters the ws-manager into the database
                let perfereability = Preferability.NONE;
                let controller = "";
                let state: WorkspaceClusterState = "available";
                if (req.hints) {
                    perfereability = req.hints.perfereability;
                    if (req.hints.govern) {
                        controller = this.config.installation;
                    }
                    state = mapCordoned(req.hints.cordoned);
                }
                let score = mapPreferabilityToScore(perfereability);
                if (!score) {
                    throw new GRPCError(grpc.status.INVALID_ARGUMENT, `unknown Preferability ${perfereability}!`);
                }

                let certificate: string | undefined = undefined;
                if (typeof req.cert === "string" && req.cert !== "") {
                    certificate = req.cert;
                }

                const newCluster: WorkspaceCluster = {
                    name: req.name,
                    url: req.url,
                    certificate,
                    state,
                    score,
                    maxScore: 100,
                    controller,
                };
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

                if (req.maxScore !== undefined) {
                    cluster.maxScore = req.maxScore;
                }
                if (req.score !== undefined) {
                    cluster.score = req.score;
                }
                if (req.cordoned !== undefined) {
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
                    clusterStatus.setGoverned(true);
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
    const mapping = new Map<number, number>();
    mapping.set(Preferability.NONE, 50);
    mapping.set(Preferability.PREFER, 100);
    mapping.set(Preferability.DONTSCHEDULE, 0);
    return mapping.get(p);
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