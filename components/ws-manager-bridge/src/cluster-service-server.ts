/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { Queue } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import {
    WorkspaceCluster,
    WorkspaceClusterDB,
    WorkspaceClusterState,
    TLSConfig,
    AdmissionConstraint,
    AdmissionConstraintHasPermission,
    WorkspaceClusterWoTLS,
    AdmissionConstraintHasUserLevel,
    AdmissionConstraintHasMoreResources,
} from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { AdmissionConstraintHasClass } from "@gitpod/gitpod-protocol/src/workspace-cluster";
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
    UpdateResponse,
    AdmissionConstraint as GRPCAdmissionConstraint,
} from "@gitpod/ws-manager-bridge-api/lib";
import { DescribeClusterRequest, DescribeClusterResponse, WorkspaceClass } from "@gitpod/ws-manager/lib";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import {
    WorkspaceManagerClientProviderCompositeSource,
    WorkspaceManagerClientProviderSource,
} from "@gitpod/ws-manager/lib/client-provider-source";
import * as grpc from "@grpc/grpc-js";
import { ServiceError as grpcServiceError } from "@grpc/grpc-js";
import { inject, injectable } from "inversify";
import { BridgeController } from "./bridge-controller";
import { Configuration } from "./config";

export interface ClusterServiceServerOptions {
    port: number;
    host: string;
}

@injectable()
export class ClusterService implements IClusterServiceServer {
    // Satisfy the grpc.UntypedServiceImplementation interface.
    [name: string]: any;

    @inject(Configuration)
    protected readonly config: Configuration;

    @inject(WorkspaceClusterDB)
    protected readonly clusterDB: WorkspaceClusterDB;

    @inject(WorkspaceDB)
    protected readonly workspaceDB: WorkspaceDB;

    @inject(BridgeController)
    protected readonly bridgeController: BridgeController;

    @inject(WorkspaceManagerClientProvider)
    protected readonly clientProvider: WorkspaceManagerClientProvider;

    @inject(WorkspaceManagerClientProviderCompositeSource)
    protected readonly allClientProvider: WorkspaceManagerClientProviderSource;

    // using a queue to make sure we do concurrency right
    protected readonly queue: Queue = new Queue();

    public register(
        call: grpc.ServerUnaryCall<RegisterRequest, RegisterResponse>,
        callback: grpc.sendUnaryData<RegisterResponse>,
    ) {
        log.info("requested clusters.register", getClientInfo(call));
        this.queue.enqueue(async () => {
            try {
                // check if the name or URL are already registered/in use
                const req = call.request.toObject();

                const clusterByNamePromise = this.clusterDB.findByName(req.name);
                const clusterByUrlPromise = this.clusterDB.findFiltered({ url: req.url });

                const [clusterByName, clusterByUrl] = await Promise.all([clusterByNamePromise, clusterByUrlPromise]);

                if (!!clusterByName) {
                    throw new GRPCError(
                        grpc.status.ALREADY_EXISTS,
                        `a WorkspaceCluster with name ${req.name} already exists in the DB`,
                    );
                }
                if (!!clusterByUrl) {
                    if (clusterByUrl.length > 0) {
                        throw new GRPCError(
                            grpc.status.ALREADY_EXISTS,
                            `a WorkspaceCluster with url ${req.url} already exists in the DB`,
                        );
                    }
                }

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
                    key: req.tls.key,
                };

                const admissionConstraints = call.request
                    .getAdmissionConstraintsList()
                    .map(mapAdmissionConstraint)
                    .filter((c) => !!c) as AdmissionConstraint[];

                const newCluster: WorkspaceCluster = {
                    name: req.name,
                    url: req.url,
                    state,
                    score,
                    maxScore: 100,
                    govern,
                    tls,
                };

                let classConstraints = await this.getSupportedWorkspaceClasses(newCluster);
                newCluster.admissionConstraints = admissionConstraints.concat(classConstraints);

                await this.clusterDB.save(newCluster);
                log.info({}, "cluster registered", { cluster: req.name });
                this.triggerReconcile("register", req.name);

                callback(null, new RegisterResponse());
            } catch (err) {
                callback(mapToGRPCError(err), null);
            }
        });
    }

    public update(
        call: grpc.ServerUnaryCall<UpdateRequest, UpdateResponse>,
        callback: grpc.sendUnaryData<UpdateResponse>,
    ) {
        log.info("requested clusters.update", getClientInfo(call));
        this.queue.enqueue(async () => {
            try {
                const req = call.request.toObject();
                const cluster = await this.clusterDB.findByName(req.name);
                if (!cluster) {
                    throw new GRPCError(
                        grpc.status.NOT_FOUND,
                        `a WorkspaceCluster with name ${req.name} does not exist in the DB!`,
                    );
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
                if (call.request.hasAdmissionConstraint()) {
                    const mod = call.request.getAdmissionConstraint()!;
                    const c = mapAdmissionConstraint(mod.getConstraint());
                    if (!!c) {
                        if (mod.getAdd()) {
                            cluster.admissionConstraints = (cluster.admissionConstraints || []).concat([c]);
                        } else {
                            cluster.admissionConstraints = cluster.admissionConstraints?.filter((v) => {
                                if (v.type !== c.type) {
                                    return true;
                                }

                                switch (v.type) {
                                    case "has-feature-preview":
                                        return false;
                                    case "has-permission":
                                        if (v.permission === (c as AdmissionConstraintHasPermission).permission) {
                                            return false;
                                        }
                                        break;
                                    case "has-user-level":
                                        if (v.level === (c as AdmissionConstraintHasUserLevel).level) {
                                            return false;
                                        }
                                    case "has-more-resources":
                                        return false;
                                }
                                return true;
                            });
                        }
                    }
                }
                await this.clusterDB.save(cluster);
                log.info({}, "cluster updated", { cluster: req.name });
                this.triggerReconcile("update", req.name);

                callback(null, new UpdateResponse());
            } catch (err) {
                callback(mapToGRPCError(err), null);
            }
        });
    }

    public deregister(
        call: grpc.ServerUnaryCall<DeregisterRequest, DeregisterResponse>,
        callback: grpc.sendUnaryData<DeregisterResponse>,
    ) {
        log.info("requested clusters.deregister", getClientInfo(call));
        this.queue.enqueue(async () => {
            try {
                const req = call.request.toObject();

                const instances = await this.workspaceDB.findRegularRunningInstances();
                const relevantInstances = instances.filter((i) => i.region === req.name);
                if (!req.force && relevantInstances.length > 0) {
                    log.info({}, "forced cluster deregistration even though there are still instances running", {
                        cluster: req.name,
                    });
                    throw new GRPCError(
                        grpc.status.FAILED_PRECONDITION,
                        `cluster is not empty (${relevantInstances.length} instances remaining)`,
                    );
                }

                await this.clusterDB.deleteByName(req.name);
                log.info({}, "cluster deregistered", { cluster: req.name });
                this.triggerReconcile("deregister", req.name);

                callback(null, new DeregisterResponse());
            } catch (err) {
                callback(mapToGRPCError(err), null);
            }
        });
    }

    public list(call: grpc.ServerUnaryCall<ListRequest, ListResponse>, callback: grpc.sendUnaryData<ListResponse>) {
        log.info("requested clusters.list", getClientInfo(call));
        this.queue.enqueue(async () => {
            try {
                const response = new ListResponse();

                const dbClusterIdx = new Map<string, boolean>();
                const allDBClusters = await this.clusterDB.findFiltered({});
                for (const cluster of allDBClusters) {
                    const clusterStatus = convertToGRPC(cluster);
                    response.addStatus(clusterStatus);
                    dbClusterIdx.set(cluster.name, true);
                }

                const allCluster = await this.allClientProvider.getAllWorkspaceClusters();
                for (const cluster of allCluster) {
                    if (dbClusterIdx.get(cluster.name)) {
                        continue;
                    }

                    const clusterStatus = convertToGRPC(cluster);
                    clusterStatus.setStatic(true);
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
        this.bridgeController
            .runReconcileNow()
            .catch((err) => log.error("error during forced reconcile", err, payload));
    }

    public async getSupportedWorkspaceClasses(cluster: WorkspaceCluster) {
        let constraints = await new Promise<AdmissionConstraintHasClass[]>((resolve, reject) => {
            const c = this.clientProvider.createClient(cluster);
            c.describeCluster(new DescribeClusterRequest(), (err: any, resp: DescribeClusterResponse) => {
                if (err) {
                    reject(
                        new GRPCError(grpc.status.FAILED_PRECONDITION, `cannot reach ${cluster.url}: ${err.message}`),
                    );
                } else {
                    let classes = resp.getWorkspaceclassesList().map((cl) => mapWorkspaceClass(cl));
                    resolve(classes);
                }
            });
        });

        return constraints;
    }
}

function convertToGRPC(ws: WorkspaceClusterWoTLS): ClusterStatus {
    const clusterStatus = new ClusterStatus();
    clusterStatus.setName(ws.name);
    clusterStatus.setUrl(ws.url);
    clusterStatus.setState(mapClusterState(ws.state));
    clusterStatus.setScore(ws.score);
    clusterStatus.setMaxScore(ws.maxScore);
    clusterStatus.setGoverned(ws.govern);
    ws.admissionConstraints?.forEach((c) => {
        const constraint = new GRPCAdmissionConstraint();
        switch (c.type) {
            case "has-feature-preview":
                constraint.setHasFeaturePreview(new GRPCAdmissionConstraint.FeaturePreview());
                break;
            case "has-permission":
                const perm = new GRPCAdmissionConstraint.HasPermission();
                perm.setPermission(c.permission);
                constraint.setHasPermission(perm);
                break;
            case "has-user-level":
                constraint.setHasUserLevel(c.level);
                break;
            case "has-more-resources":
                constraint.setHasMoreResources(true);
                break;
            default:
                return;
        }
        clusterStatus.addAdmissionConstraint(constraint);
    });
    return clusterStatus;
}

function mapAdmissionConstraint(c: GRPCAdmissionConstraint | undefined): AdmissionConstraint | undefined {
    if (!c) {
        return;
    }

    if (c.hasHasFeaturePreview()) {
        return <AdmissionConstraint>{ type: "has-feature-preview" };
    }
    if (c.hasHasPermission()) {
        const permission = c.getHasPermission()?.getPermission();
        if (!permission) {
            return;
        }

        return <AdmissionConstraintHasPermission>{ type: "has-permission", permission };
    }
    if (c.hasHasUserLevel()) {
        const level = c.getHasUserLevel();
        if (!level) {
            return;
        }
        return <AdmissionConstraintHasUserLevel>{ type: "has-user-level", level };
    }
    if (c.hasHasMoreResources()) {
        return <AdmissionConstraintHasMoreResources>{ type: "has-more-resources" };
    }
    return;
}

function mapWorkspaceClass(c: WorkspaceClass): AdmissionConstraintHasClass {
    return <AdmissionConstraintHasClass>{ type: "has-class", id: c.getId(), displayName: c.getDisplayname() };
}

function mapPreferabilityToScore(p: Preferability): number | undefined {
    switch (p) {
        case Preferability.PREFER:
            return 100;
        case Preferability.NONE:
            return 50;
        case Preferability.DONTSCHEDULE:
            return 0;
        default:
            return undefined;
    }
}

function mapCordoned(cordoned: boolean): WorkspaceClusterState {
    return cordoned ? "cordoned" : "available";
}

function mapClusterState(state: WorkspaceClusterState): ClusterState {
    switch (state) {
        case "available":
            return ClusterState.AVAILABLE;
        case "cordoned":
            return ClusterState.CORDONED;
        case "draining":
            return ClusterState.DRAINING;
    }
}

function mapToGRPCError(err: any): any {
    if (!GRPCError.isGRPCError(err)) {
        return new GRPCError(grpc.status.INTERNAL, err);
    }
    return err;
}

function getClientInfo(call: grpc.ServerUnaryCall<any, any>) {
    const clientNameHeader = call.metadata.get("client-name");
    const userAgentHeader = call.metadata.get("user-agent");

    let [clientName, userAgent] = ["", ""];
    if (clientNameHeader.length != 0) {
        clientName = clientNameHeader[0].toString();
    }
    if (userAgentHeader.length != 0) {
        userAgent = userAgentHeader[0].toString();
    }
    const clientIP = call.getPeer();
    return { clientIP, clientName, userAgent };
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
        // Default value for maxSessionMemory is 10 which is low for this gRPC server
        // See https://nodejs.org/api/http2.html#http2_http2_connect_authority_options_listener.
        const server = new grpc.Server({
            "grpc-node.max_session_memory": 50,
        });
        // @ts-ignore
        server.addService(ClusterServiceService, this.service);
        this.server = server;

        const bindTo = `${this.config.clusterService.host}:${this.config.clusterService.port}`;
        server.bindAsync(bindTo, grpc.ServerCredentials.createInsecure(), (err, port) => {
            if (err) {
                throw err;
            }

            log.info(`gRPC server listening on: ${bindTo}`);
            server.start();
        });
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

class GRPCError extends Error implements Partial<grpcServiceError> {
    public name = "ServiceError";

    details: string;

    constructor(public readonly status: grpc.status, err: any) {
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
        return obj !== undefined && typeof obj === "object" && "status" in obj;
    }
}
