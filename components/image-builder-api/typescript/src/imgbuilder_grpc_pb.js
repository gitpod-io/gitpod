/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var imgbuilder_pb = require('./imgbuilder_pb.js');
var content$service$api_initializer_pb = require('@gitpod/content-service/lib');

function serialize_builder_BuildRequest(arg) {
    if (!(arg instanceof imgbuilder_pb.BuildRequest)) {
        throw new Error('Expected argument of type builder.BuildRequest');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_BuildRequest(buffer_arg) {
    return imgbuilder_pb.BuildRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_builder_BuildResponse(arg) {
    if (!(arg instanceof imgbuilder_pb.BuildResponse)) {
        throw new Error('Expected argument of type builder.BuildResponse');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_BuildResponse(buffer_arg) {
    return imgbuilder_pb.BuildResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_builder_ListBuildsRequest(arg) {
    if (!(arg instanceof imgbuilder_pb.ListBuildsRequest)) {
        throw new Error('Expected argument of type builder.ListBuildsRequest');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_ListBuildsRequest(buffer_arg) {
    return imgbuilder_pb.ListBuildsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_builder_ListBuildsResponse(arg) {
    if (!(arg instanceof imgbuilder_pb.ListBuildsResponse)) {
        throw new Error('Expected argument of type builder.ListBuildsResponse');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_ListBuildsResponse(buffer_arg) {
    return imgbuilder_pb.ListBuildsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_builder_LogsRequest(arg) {
    if (!(arg instanceof imgbuilder_pb.LogsRequest)) {
        throw new Error('Expected argument of type builder.LogsRequest');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_LogsRequest(buffer_arg) {
    return imgbuilder_pb.LogsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_builder_LogsResponse(arg) {
    if (!(arg instanceof imgbuilder_pb.LogsResponse)) {
        throw new Error('Expected argument of type builder.LogsResponse');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_LogsResponse(buffer_arg) {
    return imgbuilder_pb.LogsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_builder_ResolveBaseImageRequest(arg) {
    if (!(arg instanceof imgbuilder_pb.ResolveBaseImageRequest)) {
        throw new Error('Expected argument of type builder.ResolveBaseImageRequest');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_ResolveBaseImageRequest(buffer_arg) {
    return imgbuilder_pb.ResolveBaseImageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_builder_ResolveBaseImageResponse(arg) {
    if (!(arg instanceof imgbuilder_pb.ResolveBaseImageResponse)) {
        throw new Error('Expected argument of type builder.ResolveBaseImageResponse');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_ResolveBaseImageResponse(buffer_arg) {
    return imgbuilder_pb.ResolveBaseImageResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_builder_ResolveWorkspaceImageRequest(arg) {
    if (!(arg instanceof imgbuilder_pb.ResolveWorkspaceImageRequest)) {
        throw new Error('Expected argument of type builder.ResolveWorkspaceImageRequest');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_ResolveWorkspaceImageRequest(buffer_arg) {
    return imgbuilder_pb.ResolveWorkspaceImageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_builder_ResolveWorkspaceImageResponse(arg) {
    if (!(arg instanceof imgbuilder_pb.ResolveWorkspaceImageResponse)) {
        throw new Error('Expected argument of type builder.ResolveWorkspaceImageResponse');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_ResolveWorkspaceImageResponse(buffer_arg) {
    return imgbuilder_pb.ResolveWorkspaceImageResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

var ImageBuilderService = (exports.ImageBuilderService = {
    // ResolveBaseImage returns the "digest" form of a Docker image tag thereby making it absolute.
    resolveBaseImage: {
        path: '/builder.ImageBuilder/ResolveBaseImage',
        requestStream: false,
        responseStream: false,
        requestType: imgbuilder_pb.ResolveBaseImageRequest,
        responseType: imgbuilder_pb.ResolveBaseImageResponse,
        requestSerialize: serialize_builder_ResolveBaseImageRequest,
        requestDeserialize: deserialize_builder_ResolveBaseImageRequest,
        responseSerialize: serialize_builder_ResolveBaseImageResponse,
        responseDeserialize: deserialize_builder_ResolveBaseImageResponse,
    },
    // ResolveWorkspaceImage returns information about a build configuration without actually attempting to build anything.
    resolveWorkspaceImage: {
        path: '/builder.ImageBuilder/ResolveWorkspaceImage',
        requestStream: false,
        responseStream: false,
        requestType: imgbuilder_pb.ResolveWorkspaceImageRequest,
        responseType: imgbuilder_pb.ResolveWorkspaceImageResponse,
        requestSerialize: serialize_builder_ResolveWorkspaceImageRequest,
        requestDeserialize: deserialize_builder_ResolveWorkspaceImageRequest,
        responseSerialize: serialize_builder_ResolveWorkspaceImageResponse,
        responseDeserialize: deserialize_builder_ResolveWorkspaceImageResponse,
    },
    // Build initiates the build of a Docker image using a build configuration. If a build of this
    // configuration is already ongoing no new build will be started.
    build: {
        path: '/builder.ImageBuilder/Build',
        requestStream: false,
        responseStream: true,
        requestType: imgbuilder_pb.BuildRequest,
        responseType: imgbuilder_pb.BuildResponse,
        requestSerialize: serialize_builder_BuildRequest,
        requestDeserialize: deserialize_builder_BuildRequest,
        responseSerialize: serialize_builder_BuildResponse,
        responseDeserialize: deserialize_builder_BuildResponse,
    },
    // Logs listens to the build output of an ongoing Docker build identified build the build ID
    logs: {
        path: '/builder.ImageBuilder/Logs',
        requestStream: false,
        responseStream: true,
        requestType: imgbuilder_pb.LogsRequest,
        responseType: imgbuilder_pb.LogsResponse,
        requestSerialize: serialize_builder_LogsRequest,
        requestDeserialize: deserialize_builder_LogsRequest,
        responseSerialize: serialize_builder_LogsResponse,
        responseDeserialize: deserialize_builder_LogsResponse,
    },
    // ListBuilds returns a list of currently running builds
    listBuilds: {
        path: '/builder.ImageBuilder/ListBuilds',
        requestStream: false,
        responseStream: false,
        requestType: imgbuilder_pb.ListBuildsRequest,
        responseType: imgbuilder_pb.ListBuildsResponse,
        requestSerialize: serialize_builder_ListBuildsRequest,
        requestDeserialize: deserialize_builder_ListBuildsRequest,
        responseSerialize: serialize_builder_ListBuildsResponse,
        responseDeserialize: deserialize_builder_ListBuildsResponse,
    },
});

exports.ImageBuilderClient = grpc.makeGenericClientConstructor(ImageBuilderService);
