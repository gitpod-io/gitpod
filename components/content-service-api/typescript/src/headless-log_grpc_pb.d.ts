/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: contentservice
// file: headless-log.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from '@grpc/grpc-js';
import * as headless_log_pb from './headless-log_pb';

interface IHeadlessLogServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    logDownloadURL: IHeadlessLogServiceService_ILogDownloadURL;
    listLogs: IHeadlessLogServiceService_IListLogs;
}

interface IHeadlessLogServiceService_ILogDownloadURL
    extends grpc.MethodDefinition<headless_log_pb.LogDownloadURLRequest, headless_log_pb.LogDownloadURLResponse> {
    path: '/contentservice.HeadlessLogService/LogDownloadURL';
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<headless_log_pb.LogDownloadURLRequest>;
    requestDeserialize: grpc.deserialize<headless_log_pb.LogDownloadURLRequest>;
    responseSerialize: grpc.serialize<headless_log_pb.LogDownloadURLResponse>;
    responseDeserialize: grpc.deserialize<headless_log_pb.LogDownloadURLResponse>;
}
interface IHeadlessLogServiceService_IListLogs
    extends grpc.MethodDefinition<headless_log_pb.ListLogsRequest, headless_log_pb.ListLogsResponse> {
    path: '/contentservice.HeadlessLogService/ListLogs';
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<headless_log_pb.ListLogsRequest>;
    requestDeserialize: grpc.deserialize<headless_log_pb.ListLogsRequest>;
    responseSerialize: grpc.serialize<headless_log_pb.ListLogsResponse>;
    responseDeserialize: grpc.deserialize<headless_log_pb.ListLogsResponse>;
}

export const HeadlessLogServiceService: IHeadlessLogServiceService;

export interface IHeadlessLogServiceServer extends grpc.UntypedServiceImplementation {
    logDownloadURL: grpc.handleUnaryCall<headless_log_pb.LogDownloadURLRequest, headless_log_pb.LogDownloadURLResponse>;
    listLogs: grpc.handleUnaryCall<headless_log_pb.ListLogsRequest, headless_log_pb.ListLogsResponse>;
}

export interface IHeadlessLogServiceClient {
    logDownloadURL(
        request: headless_log_pb.LogDownloadURLRequest,
        callback: (error: grpc.ServiceError | null, response: headless_log_pb.LogDownloadURLResponse) => void,
    ): grpc.ClientUnaryCall;
    logDownloadURL(
        request: headless_log_pb.LogDownloadURLRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: headless_log_pb.LogDownloadURLResponse) => void,
    ): grpc.ClientUnaryCall;
    logDownloadURL(
        request: headless_log_pb.LogDownloadURLRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: headless_log_pb.LogDownloadURLResponse) => void,
    ): grpc.ClientUnaryCall;
    listLogs(
        request: headless_log_pb.ListLogsRequest,
        callback: (error: grpc.ServiceError | null, response: headless_log_pb.ListLogsResponse) => void,
    ): grpc.ClientUnaryCall;
    listLogs(
        request: headless_log_pb.ListLogsRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: headless_log_pb.ListLogsResponse) => void,
    ): grpc.ClientUnaryCall;
    listLogs(
        request: headless_log_pb.ListLogsRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: headless_log_pb.ListLogsResponse) => void,
    ): grpc.ClientUnaryCall;
}

export class HeadlessLogServiceClient extends grpc.Client implements IHeadlessLogServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public logDownloadURL(
        request: headless_log_pb.LogDownloadURLRequest,
        callback: (error: grpc.ServiceError | null, response: headless_log_pb.LogDownloadURLResponse) => void,
    ): grpc.ClientUnaryCall;
    public logDownloadURL(
        request: headless_log_pb.LogDownloadURLRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: headless_log_pb.LogDownloadURLResponse) => void,
    ): grpc.ClientUnaryCall;
    public logDownloadURL(
        request: headless_log_pb.LogDownloadURLRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: headless_log_pb.LogDownloadURLResponse) => void,
    ): grpc.ClientUnaryCall;
    public listLogs(
        request: headless_log_pb.ListLogsRequest,
        callback: (error: grpc.ServiceError | null, response: headless_log_pb.ListLogsResponse) => void,
    ): grpc.ClientUnaryCall;
    public listLogs(
        request: headless_log_pb.ListLogsRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: headless_log_pb.ListLogsResponse) => void,
    ): grpc.ClientUnaryCall;
    public listLogs(
        request: headless_log_pb.ListLogsRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: headless_log_pb.ListLogsResponse) => void,
    ): grpc.ClientUnaryCall;
}
