/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var aggregator_pb = require('./aggregator_pb.js');
var google_api_annotations_pb = require('./google/api/annotations_pb.js');

function serialize_aggregator_CloseSessionRequest(arg) {
  if (!(arg instanceof aggregator_pb.CloseSessionRequest)) {
    throw new Error('Expected argument of type aggregator.CloseSessionRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_aggregator_CloseSessionRequest(buffer_arg) {
  return aggregator_pb.CloseSessionRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_aggregator_CloseSessionResponse(arg) {
  if (!(arg instanceof aggregator_pb.CloseSessionResponse)) {
    throw new Error('Expected argument of type aggregator.CloseSessionResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_aggregator_CloseSessionResponse(buffer_arg) {
  return aggregator_pb.CloseSessionResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_aggregator_ConsumeRequest(arg) {
  if (!(arg instanceof aggregator_pb.ConsumeRequest)) {
    throw new Error('Expected argument of type aggregator.ConsumeRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_aggregator_ConsumeRequest(buffer_arg) {
  return aggregator_pb.ConsumeRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_aggregator_ConsumeResponse(arg) {
  if (!(arg instanceof aggregator_pb.ConsumeResponse)) {
    throw new Error('Expected argument of type aggregator.ConsumeResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_aggregator_ConsumeResponse(buffer_arg) {
  return aggregator_pb.ConsumeResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_aggregator_DescribeRequest(arg) {
  if (!(arg instanceof aggregator_pb.DescribeRequest)) {
    throw new Error('Expected argument of type aggregator.DescribeRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_aggregator_DescribeRequest(buffer_arg) {
  return aggregator_pb.DescribeRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_aggregator_DescribeResponse(arg) {
  if (!(arg instanceof aggregator_pb.DescribeResponse)) {
    throw new Error('Expected argument of type aggregator.DescribeResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_aggregator_DescribeResponse(buffer_arg) {
  return aggregator_pb.DescribeResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_aggregator_IngestRequest(arg) {
  if (!(arg instanceof aggregator_pb.IngestRequest)) {
    throw new Error('Expected argument of type aggregator.IngestRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_aggregator_IngestRequest(buffer_arg) {
  return aggregator_pb.IngestRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_aggregator_IngestResponse(arg) {
  if (!(arg instanceof aggregator_pb.IngestResponse)) {
    throw new Error('Expected argument of type aggregator.IngestResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_aggregator_IngestResponse(buffer_arg) {
  return aggregator_pb.IngestResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_aggregator_StartSessionRequest(arg) {
  if (!(arg instanceof aggregator_pb.StartSessionRequest)) {
    throw new Error('Expected argument of type aggregator.StartSessionRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_aggregator_StartSessionRequest(buffer_arg) {
  return aggregator_pb.StartSessionRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_aggregator_StartSessionResponse(arg) {
  if (!(arg instanceof aggregator_pb.StartSessionResponse)) {
    throw new Error('Expected argument of type aggregator.StartSessionResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_aggregator_StartSessionResponse(buffer_arg) {
  return aggregator_pb.StartSessionResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var AggregatorService = exports.AggregatorService = {
  startSession: {
    path: '/aggregator.Aggregator/StartSession',
    requestStream: false,
    responseStream: false,
    requestType: aggregator_pb.StartSessionRequest,
    responseType: aggregator_pb.StartSessionResponse,
    requestSerialize: serialize_aggregator_StartSessionRequest,
    requestDeserialize: deserialize_aggregator_StartSessionRequest,
    responseSerialize: serialize_aggregator_StartSessionResponse,
    responseDeserialize: deserialize_aggregator_StartSessionResponse,
  },
  closeSession: {
    path: '/aggregator.Aggregator/CloseSession',
    requestStream: false,
    responseStream: false,
    requestType: aggregator_pb.CloseSessionRequest,
    responseType: aggregator_pb.CloseSessionResponse,
    requestSerialize: serialize_aggregator_CloseSessionRequest,
    requestDeserialize: deserialize_aggregator_CloseSessionRequest,
    responseSerialize: serialize_aggregator_CloseSessionResponse,
    responseDeserialize: deserialize_aggregator_CloseSessionResponse,
  },
  describe: {
    path: '/aggregator.Aggregator/Describe',
    requestStream: false,
    responseStream: false,
    requestType: aggregator_pb.DescribeRequest,
    responseType: aggregator_pb.DescribeResponse,
    requestSerialize: serialize_aggregator_DescribeRequest,
    requestDeserialize: deserialize_aggregator_DescribeRequest,
    responseSerialize: serialize_aggregator_DescribeResponse,
    responseDeserialize: deserialize_aggregator_DescribeResponse,
  },
  consume: {
    path: '/aggregator.Aggregator/Consume',
    requestStream: false,
    responseStream: true,
    requestType: aggregator_pb.ConsumeRequest,
    responseType: aggregator_pb.ConsumeResponse,
    requestSerialize: serialize_aggregator_ConsumeRequest,
    requestDeserialize: deserialize_aggregator_ConsumeRequest,
    responseSerialize: serialize_aggregator_ConsumeResponse,
    responseDeserialize: deserialize_aggregator_ConsumeResponse,
  },
};

exports.AggregatorClient = grpc.makeGenericClientConstructor(AggregatorService);
var IngesterService = exports.IngesterService = {
  ingest: {
    path: '/aggregator.Ingester/Ingest',
    requestStream: false,
    responseStream: false,
    requestType: aggregator_pb.IngestRequest,
    responseType: aggregator_pb.IngestResponse,
    requestSerialize: serialize_aggregator_IngestRequest,
    requestDeserialize: deserialize_aggregator_IngestRequest,
    responseSerialize: serialize_aggregator_IngestResponse,
    responseDeserialize: deserialize_aggregator_IngestResponse,
  },
};

exports.IngesterClient = grpc.makeGenericClientConstructor(IngesterService);
