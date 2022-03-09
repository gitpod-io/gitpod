// package: gitpod.v1
// file: gitpod/v1/prebuilds.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as gitpod_v1_prebuilds_pb from "../../gitpod/v1/prebuilds_pb";
import * as gitpod_v1_pagination_pb from "../../gitpod/v1/pagination_pb";

interface IPrebuildsServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    getRunningPrebuild: IPrebuildsServiceService_IGetRunningPrebuild;
}

interface IPrebuildsServiceService_IGetRunningPrebuild extends grpc.MethodDefinition<gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse> {
    path: "/gitpod.v1.PrebuildsService/GetRunningPrebuild";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse>;
}

export const PrebuildsServiceService: IPrebuildsServiceService;

export interface IPrebuildsServiceServer extends grpc.UntypedServiceImplementation {
    getRunningPrebuild: grpc.handleUnaryCall<gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse>;
}

export interface IPrebuildsServiceClient {
    getRunningPrebuild(request: gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse) => void): grpc.ClientUnaryCall;
    getRunningPrebuild(request: gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse) => void): grpc.ClientUnaryCall;
    getRunningPrebuild(request: gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse) => void): grpc.ClientUnaryCall;
}

export class PrebuildsServiceClient extends grpc.Client implements IPrebuildsServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public getRunningPrebuild(request: gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse) => void): grpc.ClientUnaryCall;
    public getRunningPrebuild(request: gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse) => void): grpc.ClientUnaryCall;
    public getRunningPrebuild(request: gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse) => void): grpc.ClientUnaryCall;
}
