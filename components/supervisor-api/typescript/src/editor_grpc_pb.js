// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var editor_pb = require('./editor_pb.js');

function serialize_supervisor_CloseEditorRequest(arg) {
  if (!(arg instanceof editor_pb.CloseEditorRequest)) {
    throw new Error('Expected argument of type supervisor.CloseEditorRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_CloseEditorRequest(buffer_arg) {
  return editor_pb.CloseEditorRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_CloseEditorResponse(arg) {
  if (!(arg instanceof editor_pb.CloseEditorResponse)) {
    throw new Error('Expected argument of type supervisor.CloseEditorResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_CloseEditorResponse(buffer_arg) {
  return editor_pb.CloseEditorResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_GetActiveEditorRequest(arg) {
  if (!(arg instanceof editor_pb.GetActiveEditorRequest)) {
    throw new Error('Expected argument of type supervisor.GetActiveEditorRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_GetActiveEditorRequest(buffer_arg) {
  return editor_pb.GetActiveEditorRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_GetActiveEditorResponse(arg) {
  if (!(arg instanceof editor_pb.GetActiveEditorResponse)) {
    throw new Error('Expected argument of type supervisor.GetActiveEditorResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_GetActiveEditorResponse(buffer_arg) {
  return editor_pb.GetActiveEditorResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_ListEditorsRequest(arg) {
  if (!(arg instanceof editor_pb.ListEditorsRequest)) {
    throw new Error('Expected argument of type supervisor.ListEditorsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ListEditorsRequest(buffer_arg) {
  return editor_pb.ListEditorsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_ListEditorsResponse(arg) {
  if (!(arg instanceof editor_pb.ListEditorsResponse)) {
    throw new Error('Expected argument of type supervisor.ListEditorsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ListEditorsResponse(buffer_arg) {
  return editor_pb.ListEditorsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_OpenEditorRequest(arg) {
  if (!(arg instanceof editor_pb.OpenEditorRequest)) {
    throw new Error('Expected argument of type supervisor.OpenEditorRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_OpenEditorRequest(buffer_arg) {
  return editor_pb.OpenEditorRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_OpenEditorResponse(arg) {
  if (!(arg instanceof editor_pb.OpenEditorResponse)) {
    throw new Error('Expected argument of type supervisor.OpenEditorResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_OpenEditorResponse(buffer_arg) {
  return editor_pb.OpenEditorResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_SetActiveEditorRequest(arg) {
  if (!(arg instanceof editor_pb.SetActiveEditorRequest)) {
    throw new Error('Expected argument of type supervisor.SetActiveEditorRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_SetActiveEditorRequest(buffer_arg) {
  return editor_pb.SetActiveEditorRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_SetActiveEditorResponse(arg) {
  if (!(arg instanceof editor_pb.SetActiveEditorResponse)) {
    throw new Error('Expected argument of type supervisor.SetActiveEditorResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_SetActiveEditorResponse(buffer_arg) {
  return editor_pb.SetActiveEditorResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_WriteEditorRequest(arg) {
  if (!(arg instanceof editor_pb.WriteEditorRequest)) {
    throw new Error('Expected argument of type supervisor.WriteEditorRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_WriteEditorRequest(buffer_arg) {
  return editor_pb.WriteEditorRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_WriteEditorResponse(arg) {
  if (!(arg instanceof editor_pb.WriteEditorResponse)) {
    throw new Error('Expected argument of type supervisor.WriteEditorResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_WriteEditorResponse(buffer_arg) {
  return editor_pb.WriteEditorResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var EditorServiceService = exports.EditorServiceService = {
  list: {
    path: '/supervisor.EditorService/List',
    requestStream: false,
    responseStream: false,
    requestType: editor_pb.ListEditorsRequest,
    responseType: editor_pb.ListEditorsResponse,
    requestSerialize: serialize_supervisor_ListEditorsRequest,
    requestDeserialize: deserialize_supervisor_ListEditorsRequest,
    responseSerialize: serialize_supervisor_ListEditorsResponse,
    responseDeserialize: deserialize_supervisor_ListEditorsResponse,
  },
  open: {
    path: '/supervisor.EditorService/Open',
    requestStream: false,
    responseStream: false,
    requestType: editor_pb.OpenEditorRequest,
    responseType: editor_pb.OpenEditorResponse,
    requestSerialize: serialize_supervisor_OpenEditorRequest,
    requestDeserialize: deserialize_supervisor_OpenEditorRequest,
    responseSerialize: serialize_supervisor_OpenEditorResponse,
    responseDeserialize: deserialize_supervisor_OpenEditorResponse,
  },
  close: {
    path: '/supervisor.EditorService/Close',
    requestStream: false,
    responseStream: false,
    requestType: editor_pb.CloseEditorRequest,
    responseType: editor_pb.CloseEditorResponse,
    requestSerialize: serialize_supervisor_CloseEditorRequest,
    requestDeserialize: deserialize_supervisor_CloseEditorRequest,
    responseSerialize: serialize_supervisor_CloseEditorResponse,
    responseDeserialize: deserialize_supervisor_CloseEditorResponse,
  },
  getActive: {
    path: '/supervisor.EditorService/GetActive',
    requestStream: false,
    responseStream: false,
    requestType: editor_pb.GetActiveEditorRequest,
    responseType: editor_pb.GetActiveEditorResponse,
    requestSerialize: serialize_supervisor_GetActiveEditorRequest,
    requestDeserialize: deserialize_supervisor_GetActiveEditorRequest,
    responseSerialize: serialize_supervisor_GetActiveEditorResponse,
    responseDeserialize: deserialize_supervisor_GetActiveEditorResponse,
  },
  setActive: {
    path: '/supervisor.EditorService/SetActive',
    requestStream: false,
    responseStream: false,
    requestType: editor_pb.SetActiveEditorRequest,
    responseType: editor_pb.SetActiveEditorResponse,
    requestSerialize: serialize_supervisor_SetActiveEditorRequest,
    requestDeserialize: deserialize_supervisor_SetActiveEditorRequest,
    responseSerialize: serialize_supervisor_SetActiveEditorResponse,
    responseDeserialize: deserialize_supervisor_SetActiveEditorResponse,
  },
  write: {
    path: '/supervisor.EditorService/Write',
    requestStream: false,
    responseStream: false,
    requestType: editor_pb.WriteEditorRequest,
    responseType: editor_pb.WriteEditorResponse,
    requestSerialize: serialize_supervisor_WriteEditorRequest,
    requestDeserialize: deserialize_supervisor_WriteEditorRequest,
    responseSerialize: serialize_supervisor_WriteEditorResponse,
    responseDeserialize: deserialize_supervisor_WriteEditorResponse,
  },
};

exports.EditorServiceClient = grpc.makeGenericClientConstructor(EditorServiceService);
