/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: contentservice
// file: content.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from '@grpc/grpc-js';
import * as content_pb from './content_pb';

interface IContentServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    deleteUserContent: IContentServiceService_IDeleteUserContent;
}

interface IContentServiceService_IDeleteUserContent
    extends grpc.MethodDefinition<content_pb.DeleteUserContentRequest, content_pb.DeleteUserContentResponse> {
    path: '/contentservice.ContentService/DeleteUserContent';
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<content_pb.DeleteUserContentRequest>;
    requestDeserialize: grpc.deserialize<content_pb.DeleteUserContentRequest>;
    responseSerialize: grpc.serialize<content_pb.DeleteUserContentResponse>;
    responseDeserialize: grpc.deserialize<content_pb.DeleteUserContentResponse>;
}

export const ContentServiceService: IContentServiceService;

export interface IContentServiceServer extends grpc.UntypedServiceImplementation {
    deleteUserContent: grpc.handleUnaryCall<content_pb.DeleteUserContentRequest, content_pb.DeleteUserContentResponse>;
}

export interface IContentServiceClient {
    deleteUserContent(
        request: content_pb.DeleteUserContentRequest,
        callback: (error: grpc.ServiceError | null, response: content_pb.DeleteUserContentResponse) => void,
    ): grpc.ClientUnaryCall;
    deleteUserContent(
        request: content_pb.DeleteUserContentRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: content_pb.DeleteUserContentResponse) => void,
    ): grpc.ClientUnaryCall;
    deleteUserContent(
        request: content_pb.DeleteUserContentRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: content_pb.DeleteUserContentResponse) => void,
    ): grpc.ClientUnaryCall;
}

export class ContentServiceClient extends grpc.Client implements IContentServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public deleteUserContent(
        request: content_pb.DeleteUserContentRequest,
        callback: (error: grpc.ServiceError | null, response: content_pb.DeleteUserContentResponse) => void,
    ): grpc.ClientUnaryCall;
    public deleteUserContent(
        request: content_pb.DeleteUserContentRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: content_pb.DeleteUserContentResponse) => void,
    ): grpc.ClientUnaryCall;
    public deleteUserContent(
        request: content_pb.DeleteUserContentRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: content_pb.DeleteUserContentResponse) => void,
    ): grpc.ClientUnaryCall;
}
