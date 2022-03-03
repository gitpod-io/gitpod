// GENERATED CODE -- DO NOT EDIT!

// Original file comments:
// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
//
'use strict';
var grpc = require('@grpc/grpc-js');
var ideplugin_pb = require('./ideplugin_pb.js');

function serialize_ideplugin_PluginDownloadURLRequest(arg) {
    if (!(arg instanceof ideplugin_pb.PluginDownloadURLRequest)) {
        throw new Error('Expected argument of type ideplugin.PluginDownloadURLRequest');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_ideplugin_PluginDownloadURLRequest(buffer_arg) {
    return ideplugin_pb.PluginDownloadURLRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ideplugin_PluginDownloadURLResponse(arg) {
    if (!(arg instanceof ideplugin_pb.PluginDownloadURLResponse)) {
        throw new Error('Expected argument of type ideplugin.PluginDownloadURLResponse');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_ideplugin_PluginDownloadURLResponse(buffer_arg) {
    return ideplugin_pb.PluginDownloadURLResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ideplugin_PluginHashRequest(arg) {
    if (!(arg instanceof ideplugin_pb.PluginHashRequest)) {
        throw new Error('Expected argument of type ideplugin.PluginHashRequest');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_ideplugin_PluginHashRequest(buffer_arg) {
    return ideplugin_pb.PluginHashRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ideplugin_PluginHashResponse(arg) {
    if (!(arg instanceof ideplugin_pb.PluginHashResponse)) {
        throw new Error('Expected argument of type ideplugin.PluginHashResponse');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_ideplugin_PluginHashResponse(buffer_arg) {
    return ideplugin_pb.PluginHashResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ideplugin_PluginUploadURLRequest(arg) {
    if (!(arg instanceof ideplugin_pb.PluginUploadURLRequest)) {
        throw new Error('Expected argument of type ideplugin.PluginUploadURLRequest');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_ideplugin_PluginUploadURLRequest(buffer_arg) {
    return ideplugin_pb.PluginUploadURLRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ideplugin_PluginUploadURLResponse(arg) {
    if (!(arg instanceof ideplugin_pb.PluginUploadURLResponse)) {
        throw new Error('Expected argument of type ideplugin.PluginUploadURLResponse');
    }
    return Buffer.from(arg.serializeBinary());
}

function deserialize_ideplugin_PluginUploadURLResponse(buffer_arg) {
    return ideplugin_pb.PluginUploadURLResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

var IDEPluginServiceService = (exports.IDEPluginServiceService = {
    // UploadURL provides a URL to which clients can upload the content via HTTP PUT.
    uploadURL: {
        path: '/ideplugin.IDEPluginService/UploadURL',
        requestStream: false,
        responseStream: false,
        requestType: ideplugin_pb.PluginUploadURLRequest,
        responseType: ideplugin_pb.PluginUploadURLResponse,
        requestSerialize: serialize_ideplugin_PluginUploadURLRequest,
        requestDeserialize: deserialize_ideplugin_PluginUploadURLRequest,
        responseSerialize: serialize_ideplugin_PluginUploadURLResponse,
        responseDeserialize: deserialize_ideplugin_PluginUploadURLResponse,
    },
    // DownloadURL provides a URL from which clients can download the content via HTTP GET.
    downloadURL: {
        path: '/ideplugin.IDEPluginService/DownloadURL',
        requestStream: false,
        responseStream: false,
        requestType: ideplugin_pb.PluginDownloadURLRequest,
        responseType: ideplugin_pb.PluginDownloadURLResponse,
        requestSerialize: serialize_ideplugin_PluginDownloadURLRequest,
        requestDeserialize: deserialize_ideplugin_PluginDownloadURLRequest,
        responseSerialize: serialize_ideplugin_PluginDownloadURLResponse,
        responseDeserialize: deserialize_ideplugin_PluginDownloadURLResponse,
    },
    // PluginHash provides a hash of the plugin
    pluginHash: {
        path: '/ideplugin.IDEPluginService/PluginHash',
        requestStream: false,
        responseStream: false,
        requestType: ideplugin_pb.PluginHashRequest,
        responseType: ideplugin_pb.PluginHashResponse,
        requestSerialize: serialize_ideplugin_PluginHashRequest,
        requestDeserialize: deserialize_ideplugin_PluginHashRequest,
        responseSerialize: serialize_ideplugin_PluginHashResponse,
        responseDeserialize: deserialize_ideplugin_PluginHashResponse,
    },
});

exports.IDEPluginServiceClient = grpc.makeGenericClientConstructor(IDEPluginServiceService);
