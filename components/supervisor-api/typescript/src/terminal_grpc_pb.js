// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var terminal_pb = require('./terminal_pb.js');

function serialize_supervisor_ListTerminalsRequest(arg) {
  if (!(arg instanceof terminal_pb.ListTerminalsRequest)) {
    throw new Error('Expected argument of type supervisor.ListTerminalsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ListTerminalsRequest(buffer_arg) {
  return terminal_pb.ListTerminalsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_ListTerminalsResponse(arg) {
  if (!(arg instanceof terminal_pb.ListTerminalsResponse)) {
    throw new Error('Expected argument of type supervisor.ListTerminalsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ListTerminalsResponse(buffer_arg) {
  return terminal_pb.ListTerminalsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_ListenTerminalRequest(arg) {
  if (!(arg instanceof terminal_pb.ListenTerminalRequest)) {
    throw new Error('Expected argument of type supervisor.ListenTerminalRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ListenTerminalRequest(buffer_arg) {
  return terminal_pb.ListenTerminalRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_ListenTerminalResponse(arg) {
  if (!(arg instanceof terminal_pb.ListenTerminalResponse)) {
    throw new Error('Expected argument of type supervisor.ListenTerminalResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ListenTerminalResponse(buffer_arg) {
  return terminal_pb.ListenTerminalResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_OpenTerminalRequest(arg) {
  if (!(arg instanceof terminal_pb.OpenTerminalRequest)) {
    throw new Error('Expected argument of type supervisor.OpenTerminalRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_OpenTerminalRequest(buffer_arg) {
  return terminal_pb.OpenTerminalRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_OpenTerminalResponse(arg) {
  if (!(arg instanceof terminal_pb.OpenTerminalResponse)) {
    throw new Error('Expected argument of type supervisor.OpenTerminalResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_OpenTerminalResponse(buffer_arg) {
  return terminal_pb.OpenTerminalResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_SetTerminalSizeRequest(arg) {
  if (!(arg instanceof terminal_pb.SetTerminalSizeRequest)) {
    throw new Error('Expected argument of type supervisor.SetTerminalSizeRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_SetTerminalSizeRequest(buffer_arg) {
  return terminal_pb.SetTerminalSizeRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_SetTerminalSizeResponse(arg) {
  if (!(arg instanceof terminal_pb.SetTerminalSizeResponse)) {
    throw new Error('Expected argument of type supervisor.SetTerminalSizeResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_SetTerminalSizeResponse(buffer_arg) {
  return terminal_pb.SetTerminalSizeResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_WriteTerminalRequest(arg) {
  if (!(arg instanceof terminal_pb.WriteTerminalRequest)) {
    throw new Error('Expected argument of type supervisor.WriteTerminalRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_WriteTerminalRequest(buffer_arg) {
  return terminal_pb.WriteTerminalRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_WriteTerminalResponse(arg) {
  if (!(arg instanceof terminal_pb.WriteTerminalResponse)) {
    throw new Error('Expected argument of type supervisor.WriteTerminalResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_WriteTerminalResponse(buffer_arg) {
  return terminal_pb.WriteTerminalResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var TerminalServiceService = exports.TerminalServiceService = {
  // Open opens a new terminal running the login shell
open: {
    path: '/supervisor.TerminalService/Open',
    requestStream: false,
    responseStream: false,
    requestType: terminal_pb.OpenTerminalRequest,
    responseType: terminal_pb.OpenTerminalResponse,
    requestSerialize: serialize_supervisor_OpenTerminalRequest,
    requestDeserialize: deserialize_supervisor_OpenTerminalRequest,
    responseSerialize: serialize_supervisor_OpenTerminalResponse,
    responseDeserialize: deserialize_supervisor_OpenTerminalResponse,
  },
  // List lists all open terminals
list: {
    path: '/supervisor.TerminalService/List',
    requestStream: false,
    responseStream: false,
    requestType: terminal_pb.ListTerminalsRequest,
    responseType: terminal_pb.ListTerminalsResponse,
    requestSerialize: serialize_supervisor_ListTerminalsRequest,
    requestDeserialize: deserialize_supervisor_ListTerminalsRequest,
    responseSerialize: serialize_supervisor_ListTerminalsResponse,
    responseDeserialize: deserialize_supervisor_ListTerminalsResponse,
  },
  // Listen listens to a terminal
listen: {
    path: '/supervisor.TerminalService/Listen',
    requestStream: false,
    responseStream: true,
    requestType: terminal_pb.ListenTerminalRequest,
    responseType: terminal_pb.ListenTerminalResponse,
    requestSerialize: serialize_supervisor_ListenTerminalRequest,
    requestDeserialize: deserialize_supervisor_ListenTerminalRequest,
    responseSerialize: serialize_supervisor_ListenTerminalResponse,
    responseDeserialize: deserialize_supervisor_ListenTerminalResponse,
  },
  // Write writes to a terminal
write: {
    path: '/supervisor.TerminalService/Write',
    requestStream: false,
    responseStream: false,
    requestType: terminal_pb.WriteTerminalRequest,
    responseType: terminal_pb.WriteTerminalResponse,
    requestSerialize: serialize_supervisor_WriteTerminalRequest,
    requestDeserialize: deserialize_supervisor_WriteTerminalRequest,
    responseSerialize: serialize_supervisor_WriteTerminalResponse,
    responseDeserialize: deserialize_supervisor_WriteTerminalResponse,
  },
  // SetSize sets the terminal's size
setSize: {
    path: '/supervisor.TerminalService/SetSize',
    requestStream: false,
    responseStream: false,
    requestType: terminal_pb.SetTerminalSizeRequest,
    responseType: terminal_pb.SetTerminalSizeResponse,
    requestSerialize: serialize_supervisor_SetTerminalSizeRequest,
    requestDeserialize: deserialize_supervisor_SetTerminalSizeRequest,
    responseSerialize: serialize_supervisor_SetTerminalSizeResponse,
    responseDeserialize: deserialize_supervisor_SetTerminalSizeResponse,
  },
};

exports.TerminalServiceClient = grpc.makeGenericClientConstructor(TerminalServiceService);
