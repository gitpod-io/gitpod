/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: aggregator
// file: aggregator.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as aggregator_pb from "./aggregator_pb";

interface IAggregatorService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    startSession: IAggregatorService_IStartSession;
    closeSession: IAggregatorService_ICloseSession;
    describe: IAggregatorService_IDescribe;
    consume: IAggregatorService_IConsume;
}

interface IAggregatorService_IStartSession extends grpc.MethodDefinition<aggregator_pb.StartSessionRequest, aggregator_pb.StartSessionResponse> {
    path: "/aggregator.Aggregator/StartSession";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<aggregator_pb.StartSessionRequest>;
    requestDeserialize: grpc.deserialize<aggregator_pb.StartSessionRequest>;
    responseSerialize: grpc.serialize<aggregator_pb.StartSessionResponse>;
    responseDeserialize: grpc.deserialize<aggregator_pb.StartSessionResponse>;
}
interface IAggregatorService_ICloseSession extends grpc.MethodDefinition<aggregator_pb.CloseSessionRequest, aggregator_pb.CloseSessionResponse> {
    path: "/aggregator.Aggregator/CloseSession";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<aggregator_pb.CloseSessionRequest>;
    requestDeserialize: grpc.deserialize<aggregator_pb.CloseSessionRequest>;
    responseSerialize: grpc.serialize<aggregator_pb.CloseSessionResponse>;
    responseDeserialize: grpc.deserialize<aggregator_pb.CloseSessionResponse>;
}
interface IAggregatorService_IDescribe extends grpc.MethodDefinition<aggregator_pb.DescribeRequest, aggregator_pb.DescribeResponse> {
    path: "/aggregator.Aggregator/Describe";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<aggregator_pb.DescribeRequest>;
    requestDeserialize: grpc.deserialize<aggregator_pb.DescribeRequest>;
    responseSerialize: grpc.serialize<aggregator_pb.DescribeResponse>;
    responseDeserialize: grpc.deserialize<aggregator_pb.DescribeResponse>;
}
interface IAggregatorService_IConsume extends grpc.MethodDefinition<aggregator_pb.ConsumeRequest, aggregator_pb.ConsumeResponse> {
    path: "/aggregator.Aggregator/Consume";
    requestStream: false;
    responseStream: true;
    requestSerialize: grpc.serialize<aggregator_pb.ConsumeRequest>;
    requestDeserialize: grpc.deserialize<aggregator_pb.ConsumeRequest>;
    responseSerialize: grpc.serialize<aggregator_pb.ConsumeResponse>;
    responseDeserialize: grpc.deserialize<aggregator_pb.ConsumeResponse>;
}

export const AggregatorService: IAggregatorService;

export interface IAggregatorServer extends grpc.UntypedServiceImplementation {
    startSession: grpc.handleUnaryCall<aggregator_pb.StartSessionRequest, aggregator_pb.StartSessionResponse>;
    closeSession: grpc.handleUnaryCall<aggregator_pb.CloseSessionRequest, aggregator_pb.CloseSessionResponse>;
    describe: grpc.handleUnaryCall<aggregator_pb.DescribeRequest, aggregator_pb.DescribeResponse>;
    consume: grpc.handleServerStreamingCall<aggregator_pb.ConsumeRequest, aggregator_pb.ConsumeResponse>;
}

export interface IAggregatorClient {
    startSession(request: aggregator_pb.StartSessionRequest, callback: (error: grpc.ServiceError | null, response: aggregator_pb.StartSessionResponse) => void): grpc.ClientUnaryCall;
    startSession(request: aggregator_pb.StartSessionRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: aggregator_pb.StartSessionResponse) => void): grpc.ClientUnaryCall;
    startSession(request: aggregator_pb.StartSessionRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: aggregator_pb.StartSessionResponse) => void): grpc.ClientUnaryCall;
    closeSession(request: aggregator_pb.CloseSessionRequest, callback: (error: grpc.ServiceError | null, response: aggregator_pb.CloseSessionResponse) => void): grpc.ClientUnaryCall;
    closeSession(request: aggregator_pb.CloseSessionRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: aggregator_pb.CloseSessionResponse) => void): grpc.ClientUnaryCall;
    closeSession(request: aggregator_pb.CloseSessionRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: aggregator_pb.CloseSessionResponse) => void): grpc.ClientUnaryCall;
    describe(request: aggregator_pb.DescribeRequest, callback: (error: grpc.ServiceError | null, response: aggregator_pb.DescribeResponse) => void): grpc.ClientUnaryCall;
    describe(request: aggregator_pb.DescribeRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: aggregator_pb.DescribeResponse) => void): grpc.ClientUnaryCall;
    describe(request: aggregator_pb.DescribeRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: aggregator_pb.DescribeResponse) => void): grpc.ClientUnaryCall;
    consume(request: aggregator_pb.ConsumeRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<aggregator_pb.ConsumeResponse>;
    consume(request: aggregator_pb.ConsumeRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<aggregator_pb.ConsumeResponse>;
}

export class AggregatorClient extends grpc.Client implements IAggregatorClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public startSession(request: aggregator_pb.StartSessionRequest, callback: (error: grpc.ServiceError | null, response: aggregator_pb.StartSessionResponse) => void): grpc.ClientUnaryCall;
    public startSession(request: aggregator_pb.StartSessionRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: aggregator_pb.StartSessionResponse) => void): grpc.ClientUnaryCall;
    public startSession(request: aggregator_pb.StartSessionRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: aggregator_pb.StartSessionResponse) => void): grpc.ClientUnaryCall;
    public closeSession(request: aggregator_pb.CloseSessionRequest, callback: (error: grpc.ServiceError | null, response: aggregator_pb.CloseSessionResponse) => void): grpc.ClientUnaryCall;
    public closeSession(request: aggregator_pb.CloseSessionRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: aggregator_pb.CloseSessionResponse) => void): grpc.ClientUnaryCall;
    public closeSession(request: aggregator_pb.CloseSessionRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: aggregator_pb.CloseSessionResponse) => void): grpc.ClientUnaryCall;
    public describe(request: aggregator_pb.DescribeRequest, callback: (error: grpc.ServiceError | null, response: aggregator_pb.DescribeResponse) => void): grpc.ClientUnaryCall;
    public describe(request: aggregator_pb.DescribeRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: aggregator_pb.DescribeResponse) => void): grpc.ClientUnaryCall;
    public describe(request: aggregator_pb.DescribeRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: aggregator_pb.DescribeResponse) => void): grpc.ClientUnaryCall;
    public consume(request: aggregator_pb.ConsumeRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<aggregator_pb.ConsumeResponse>;
    public consume(request: aggregator_pb.ConsumeRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<aggregator_pb.ConsumeResponse>;
}

interface IIngesterService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    ingest: IIngesterService_IIngest;
}

interface IIngesterService_IIngest extends grpc.MethodDefinition<aggregator_pb.IngestRequest, aggregator_pb.IngestResponse> {
    path: "/aggregator.Ingester/Ingest";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<aggregator_pb.IngestRequest>;
    requestDeserialize: grpc.deserialize<aggregator_pb.IngestRequest>;
    responseSerialize: grpc.serialize<aggregator_pb.IngestResponse>;
    responseDeserialize: grpc.deserialize<aggregator_pb.IngestResponse>;
}

export const IngesterService: IIngesterService;

export interface IIngesterServer extends grpc.UntypedServiceImplementation {
    ingest: grpc.handleUnaryCall<aggregator_pb.IngestRequest, aggregator_pb.IngestResponse>;
}

export interface IIngesterClient {
    ingest(request: aggregator_pb.IngestRequest, callback: (error: grpc.ServiceError | null, response: aggregator_pb.IngestResponse) => void): grpc.ClientUnaryCall;
    ingest(request: aggregator_pb.IngestRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: aggregator_pb.IngestResponse) => void): grpc.ClientUnaryCall;
    ingest(request: aggregator_pb.IngestRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: aggregator_pb.IngestResponse) => void): grpc.ClientUnaryCall;
}

export class IngesterClient extends grpc.Client implements IIngesterClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public ingest(request: aggregator_pb.IngestRequest, callback: (error: grpc.ServiceError | null, response: aggregator_pb.IngestResponse) => void): grpc.ClientUnaryCall;
    public ingest(request: aggregator_pb.IngestRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: aggregator_pb.IngestResponse) => void): grpc.ClientUnaryCall;
    public ingest(request: aggregator_pb.IngestRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: aggregator_pb.IngestResponse) => void): grpc.ClientUnaryCall;
}
