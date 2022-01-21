// GENERATED CODE -- DO NOT EDIT!

// Original file comments:
// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
//
'use strict';
var grpc = require('@grpc/grpc-js');
var headless$log_pb = require('./headless-log_pb.js');

function serialize_contentservice_ListLogsRequest(arg) {
  if (!(arg instanceof headless$log_pb.ListLogsRequest)) {
    throw new Error('Expected argument of type contentservice.ListLogsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_ListLogsRequest(buffer_arg) {
  return headless$log_pb.ListLogsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_ListLogsResponse(arg) {
  if (!(arg instanceof headless$log_pb.ListLogsResponse)) {
    throw new Error('Expected argument of type contentservice.ListLogsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_ListLogsResponse(buffer_arg) {
  return headless$log_pb.ListLogsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_LogDownloadURLRequest(arg) {
  if (!(arg instanceof headless$log_pb.LogDownloadURLRequest)) {
    throw new Error('Expected argument of type contentservice.LogDownloadURLRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_LogDownloadURLRequest(buffer_arg) {
  return headless$log_pb.LogDownloadURLRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_LogDownloadURLResponse(arg) {
  if (!(arg instanceof headless$log_pb.LogDownloadURLResponse)) {
    throw new Error('Expected argument of type contentservice.LogDownloadURLResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_LogDownloadURLResponse(buffer_arg) {
  return headless$log_pb.LogDownloadURLResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

var HeadlessLogServiceService = (exports.HeadlessLogServiceService = {
  // LogDownloadURL provides a URL from where the content of a workspace can be downloaded from
  logDownloadURL: {
    path: '/contentservice.HeadlessLogService/LogDownloadURL',
    requestStream: false,
    responseStream: false,
    requestType: headless$log_pb.LogDownloadURLRequest,
    responseType: headless$log_pb.LogDownloadURLResponse,
    requestSerialize: serialize_contentservice_LogDownloadURLRequest,
    requestDeserialize: deserialize_contentservice_LogDownloadURLRequest,
    responseSerialize: serialize_contentservice_LogDownloadURLResponse,
    responseDeserialize: deserialize_contentservice_LogDownloadURLResponse,
  },
  // ListLogs returns a list of taskIds for the specified workspace instance
  listLogs: {
    path: '/contentservice.HeadlessLogService/ListLogs',
    requestStream: false,
    responseStream: false,
    requestType: headless$log_pb.ListLogsRequest,
    responseType: headless$log_pb.ListLogsResponse,
    requestSerialize: serialize_contentservice_ListLogsRequest,
    requestDeserialize: deserialize_contentservice_ListLogsRequest,
    responseSerialize: serialize_contentservice_ListLogsResponse,
    responseDeserialize: deserialize_contentservice_ListLogsResponse,
  },
});

exports.HeadlessLogServiceClient = grpc.makeGenericClientConstructor(HeadlessLogServiceService);
