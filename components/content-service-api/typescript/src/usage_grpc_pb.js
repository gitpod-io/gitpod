// GENERATED CODE -- DO NOT EDIT!

// Original file comments:
// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
//
'use strict';
var grpc = require('@grpc/grpc-js');
var usage_pb = require('./usage_pb.js');

function serialize_contentservice_UsageReportDownloadURLRequest(arg) {
  if (!(arg instanceof usage_pb.UsageReportDownloadURLRequest)) {
    throw new Error('Expected argument of type contentservice.UsageReportDownloadURLRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_UsageReportDownloadURLRequest(buffer_arg) {
  return usage_pb.UsageReportDownloadURLRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_UsageReportDownloadURLResponse(arg) {
  if (!(arg instanceof usage_pb.UsageReportDownloadURLResponse)) {
    throw new Error('Expected argument of type contentservice.UsageReportDownloadURLResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_UsageReportDownloadURLResponse(buffer_arg) {
  return usage_pb.UsageReportDownloadURLResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_UsageReportUploadURLRequest(arg) {
  if (!(arg instanceof usage_pb.UsageReportUploadURLRequest)) {
    throw new Error('Expected argument of type contentservice.UsageReportUploadURLRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_UsageReportUploadURLRequest(buffer_arg) {
  return usage_pb.UsageReportUploadURLRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_UsageReportUploadURLResponse(arg) {
  if (!(arg instanceof usage_pb.UsageReportUploadURLResponse)) {
    throw new Error('Expected argument of type contentservice.UsageReportUploadURLResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_UsageReportUploadURLResponse(buffer_arg) {
  return usage_pb.UsageReportUploadURLResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var UsageReportServiceService = exports.UsageReportServiceService = {
  // UploadURL provides a URL to which clients can upload the content via HTTP PUT.
uploadURL: {
    path: '/contentservice.UsageReportService/UploadURL',
    requestStream: false,
    responseStream: false,
    requestType: usage_pb.UsageReportUploadURLRequest,
    responseType: usage_pb.UsageReportUploadURLResponse,
    requestSerialize: serialize_contentservice_UsageReportUploadURLRequest,
    requestDeserialize: deserialize_contentservice_UsageReportUploadURLRequest,
    responseSerialize: serialize_contentservice_UsageReportUploadURLResponse,
    responseDeserialize: deserialize_contentservice_UsageReportUploadURLResponse,
  },
  // DownloadURL retrieves a URL which can be used to download a Usage Report.
downloadURL: {
    path: '/contentservice.UsageReportService/DownloadURL',
    requestStream: false,
    responseStream: false,
    requestType: usage_pb.UsageReportDownloadURLRequest,
    responseType: usage_pb.UsageReportDownloadURLResponse,
    requestSerialize: serialize_contentservice_UsageReportDownloadURLRequest,
    requestDeserialize: deserialize_contentservice_UsageReportDownloadURLRequest,
    responseSerialize: serialize_contentservice_UsageReportDownloadURLResponse,
    responseDeserialize: deserialize_contentservice_UsageReportDownloadURLResponse,
  },
};

exports.UsageReportServiceClient = grpc.makeGenericClientConstructor(UsageReportServiceService);
