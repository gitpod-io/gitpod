/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var info_pb = require('./info_pb.js');

function serialize_supervisor_WorkspaceInfoRequest(arg) {
    if (!(arg instanceof info_pb.WorkspaceInfoRequest)) {
        throw new Error('Expected argument of type supervisor.WorkspaceInfoRequest');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_WorkspaceInfoRequest(buffer_arg) {
    return info_pb.WorkspaceInfoRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_WorkspaceInfoResponse(arg) {
    if (!(arg instanceof info_pb.WorkspaceInfoResponse)) {
        throw new Error('Expected argument of type supervisor.WorkspaceInfoResponse');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_WorkspaceInfoResponse(buffer_arg) {
    return info_pb.WorkspaceInfoResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

var InfoServiceService = (exports.InfoServiceService = {
    workspaceInfo: {
        path: '/supervisor.InfoService/WorkspaceInfo',
        requestStream: false,
        responseStream: false,
        requestType: info_pb.WorkspaceInfoRequest,
        responseType: info_pb.WorkspaceInfoResponse,
        requestSerialize: serialize_supervisor_WorkspaceInfoRequest,
        requestDeserialize: deserialize_supervisor_WorkspaceInfoRequest,
        responseSerialize: serialize_supervisor_WorkspaceInfoResponse,
        responseDeserialize: deserialize_supervisor_WorkspaceInfoResponse,
    },
});

exports.InfoServiceClient = grpc.makeGenericClientConstructor(InfoServiceService);
