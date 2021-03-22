/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import {
    ClusterServiceService,
    ClusterState,
    ClusterStatus,
    DeregisterRequest,
    DeregisterResponse,
    IClusterServiceServer,
    ListRequest,
    ListResponse,
    RegisterRequest,
    RegisterResponse,
    UpdateRequest,
    UpdateResponse
} from '@gitpod/ws-manager-bridge-api/lib';
import * as grpc from "grpc";

export class ClusterServiceServer implements IClusterServiceServer {
    public register(call: grpc.ServerUnaryCall<RegisterRequest>, callback: grpc.sendUnaryData<RegisterResponse>) {
        log.warn("This is REGISTER. OK, I admit. I'm pretty lazy. Because I don't do anything here. Someone should replace me with something useful. No hard feelings.")
        const callData = call.request.toObject();
        log.warn(`The call was: ${JSON.stringify(callData)}`);
        const response = new RegisterResponse();
        callback(null, response);
    }

    public update(call: grpc.ServerUnaryCall<UpdateRequest>, callback: grpc.sendUnaryData<UpdateResponse>) {
        log.warn("This is UPDATE. OK, I admit. I'm pretty lazy. Because I don't do anything here. Someone should replace me with something useful. No hard feelings.")
        const callData = call.request.toObject();
        log.warn(`The call was: ${JSON.stringify(callData)}`);
        const response = new UpdateResponse();
        callback(null, response);
    }

    public deregister(call: grpc.ServerUnaryCall<DeregisterRequest>, callback: grpc.sendUnaryData<DeregisterResponse>) {
        log.warn("This is DEREGISTER. OK, I admit. I'm pretty lazy. Because I don't do anything here. Someone should replace me with something useful. No hard feelings.")
        const callData = call.request.toObject();
        log.warn(`The call was: ${JSON.stringify(callData)}`);
        const response = new DeregisterResponse();
        callback(null, response);
    }

    public list(call: grpc.ServerUnaryCall<ListRequest>, callback: grpc.sendUnaryData<ListResponse>) {
        log.warn("This is LIST. OK, I admit. I'm pretty lazy. Because I don't do anything here. Someone should replace me with something useful. No hard feelings.")
        const callData = call.request.toObject();
        log.warn(`The call was: ${JSON.stringify(callData)}`);
        const response = new ListResponse();
        for (let clusterId = 0; clusterId <= 5; clusterId++) {
            const clusterStatus = new ClusterStatus();
            clusterStatus.setName(`Cluster ${clusterId}`);
            clusterStatus.setUrl(`https://example.com/${clusterId}`);
            clusterStatus.setState(ClusterState.AVAILABLE);
            clusterStatus.setScore(clusterId);
            clusterStatus.setMaxScore(5);
            clusterStatus.setGoverned(true);
            response.addStatus(clusterStatus);
        }
        callback(null, response);
    }
}

export function serveClusterService(): grpc.Server {
    const server = new grpc.Server();
    server.addService(ClusterServiceService, new ClusterServiceServer());
    const bindToHost = process.env.RPC_HOST || "localhost";
    const bindToPort = process.env.RPC_PORT || "8080";
    const bindTo = `${bindToHost}:${bindToPort}`;
    const port = server.bind(bindTo, grpc.ServerCredentials.createInsecure());
    if (port === 0) {
        throw new Error(`binding gRPC server to '${bindTo}' failed`)
    }
    log.info(`gRPC listening on port ${port}`);
    server.start();
    return server;
}
