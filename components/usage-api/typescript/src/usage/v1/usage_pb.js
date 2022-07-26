/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// source: usage/v1/usage.proto
/**
 * @fileoverview
 * @enhanceable
 * @suppress {missingRequire} reports error on implicit type usages.
 * @suppress {messageConventions} JS Compiler reports an error if a variable or
 *     field starts with 'MSG_' and isn't a translatable message.
 * @public
 */
// GENERATED CODE -- DO NOT EDIT!
/* eslint-disable */
// @ts-nocheck

var jspb = require('google-protobuf');
var goog = jspb;
var global = (function() { return this || window || global || self || Function('return this')(); }).call(null);

var google_protobuf_timestamp_pb = require('google-protobuf/google/protobuf/timestamp_pb.js');
goog.object.extend(proto, google_protobuf_timestamp_pb);
goog.exportSymbol('proto.usage.v1.BilledSession', null, global);
goog.exportSymbol('proto.usage.v1.ListBilledUsageRequest', null, global);
goog.exportSymbol('proto.usage.v1.ListBilledUsageRequest.Ordering', null, global);
goog.exportSymbol('proto.usage.v1.ListBilledUsageResponse', null, global);
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.usage.v1.ListBilledUsageRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.usage.v1.ListBilledUsageRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.usage.v1.ListBilledUsageRequest.displayName = 'proto.usage.v1.ListBilledUsageRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.usage.v1.ListBilledUsageResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.usage.v1.ListBilledUsageResponse.repeatedFields_, null);
};
goog.inherits(proto.usage.v1.ListBilledUsageResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.usage.v1.ListBilledUsageResponse.displayName = 'proto.usage.v1.ListBilledUsageResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.usage.v1.BilledSession = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.usage.v1.BilledSession, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.usage.v1.BilledSession.displayName = 'proto.usage.v1.BilledSession';
}



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.usage.v1.ListBilledUsageRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.usage.v1.ListBilledUsageRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.usage.v1.ListBilledUsageRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.ListBilledUsageRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    attributionId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    from: (f = msg.getFrom()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    to: (f = msg.getTo()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    order: jspb.Message.getFieldWithDefault(msg, 4, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.usage.v1.ListBilledUsageRequest}
 */
proto.usage.v1.ListBilledUsageRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.usage.v1.ListBilledUsageRequest;
  return proto.usage.v1.ListBilledUsageRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.usage.v1.ListBilledUsageRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.usage.v1.ListBilledUsageRequest}
 */
proto.usage.v1.ListBilledUsageRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setAttributionId(value);
      break;
    case 2:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setFrom(value);
      break;
    case 3:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setTo(value);
      break;
    case 4:
      var value = /** @type {!proto.usage.v1.ListBilledUsageRequest.Ordering} */ (reader.readEnum());
      msg.setOrder(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.usage.v1.ListBilledUsageRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.usage.v1.ListBilledUsageRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.usage.v1.ListBilledUsageRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.ListBilledUsageRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getAttributionId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getFrom();
  if (f != null) {
    writer.writeMessage(
      2,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getTo();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getOrder();
  if (f !== 0.0) {
    writer.writeEnum(
      4,
      f
    );
  }
};


/**
 * @enum {number}
 */
proto.usage.v1.ListBilledUsageRequest.Ordering = {
  ORDERING_DESCENDING: 0,
  ORDERING_ASCENDING: 1
};

/**
 * optional string attribution_id = 1;
 * @return {string}
 */
proto.usage.v1.ListBilledUsageRequest.prototype.getAttributionId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.ListBilledUsageRequest} returns this
 */
proto.usage.v1.ListBilledUsageRequest.prototype.setAttributionId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional google.protobuf.Timestamp from = 2;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.usage.v1.ListBilledUsageRequest.prototype.getFrom = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 2));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.usage.v1.ListBilledUsageRequest} returns this
*/
proto.usage.v1.ListBilledUsageRequest.prototype.setFrom = function(value) {
  return jspb.Message.setWrapperField(this, 2, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.usage.v1.ListBilledUsageRequest} returns this
 */
proto.usage.v1.ListBilledUsageRequest.prototype.clearFrom = function() {
  return this.setFrom(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.usage.v1.ListBilledUsageRequest.prototype.hasFrom = function() {
  return jspb.Message.getField(this, 2) != null;
};


/**
 * optional google.protobuf.Timestamp to = 3;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.usage.v1.ListBilledUsageRequest.prototype.getTo = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 3));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.usage.v1.ListBilledUsageRequest} returns this
*/
proto.usage.v1.ListBilledUsageRequest.prototype.setTo = function(value) {
  return jspb.Message.setWrapperField(this, 3, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.usage.v1.ListBilledUsageRequest} returns this
 */
proto.usage.v1.ListBilledUsageRequest.prototype.clearTo = function() {
  return this.setTo(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.usage.v1.ListBilledUsageRequest.prototype.hasTo = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * optional Ordering order = 4;
 * @return {!proto.usage.v1.ListBilledUsageRequest.Ordering}
 */
proto.usage.v1.ListBilledUsageRequest.prototype.getOrder = function() {
  return /** @type {!proto.usage.v1.ListBilledUsageRequest.Ordering} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {!proto.usage.v1.ListBilledUsageRequest.Ordering} value
 * @return {!proto.usage.v1.ListBilledUsageRequest} returns this
 */
proto.usage.v1.ListBilledUsageRequest.prototype.setOrder = function(value) {
  return jspb.Message.setProto3EnumField(this, 4, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.usage.v1.ListBilledUsageResponse.repeatedFields_ = [1];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.usage.v1.ListBilledUsageResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.usage.v1.ListBilledUsageResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.usage.v1.ListBilledUsageResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.ListBilledUsageResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    sessionsList: jspb.Message.toObjectList(msg.getSessionsList(),
    proto.usage.v1.BilledSession.toObject, includeInstance)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.usage.v1.ListBilledUsageResponse}
 */
proto.usage.v1.ListBilledUsageResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.usage.v1.ListBilledUsageResponse;
  return proto.usage.v1.ListBilledUsageResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.usage.v1.ListBilledUsageResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.usage.v1.ListBilledUsageResponse}
 */
proto.usage.v1.ListBilledUsageResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.usage.v1.BilledSession;
      reader.readMessage(value,proto.usage.v1.BilledSession.deserializeBinaryFromReader);
      msg.addSessions(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.usage.v1.ListBilledUsageResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.usage.v1.ListBilledUsageResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.usage.v1.ListBilledUsageResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.ListBilledUsageResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSessionsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      1,
      f,
      proto.usage.v1.BilledSession.serializeBinaryToWriter
    );
  }
};


/**
 * repeated BilledSession sessions = 1;
 * @return {!Array<!proto.usage.v1.BilledSession>}
 */
proto.usage.v1.ListBilledUsageResponse.prototype.getSessionsList = function() {
  return /** @type{!Array<!proto.usage.v1.BilledSession>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.usage.v1.BilledSession, 1));
};


/**
 * @param {!Array<!proto.usage.v1.BilledSession>} value
 * @return {!proto.usage.v1.ListBilledUsageResponse} returns this
*/
proto.usage.v1.ListBilledUsageResponse.prototype.setSessionsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 1, value);
};


/**
 * @param {!proto.usage.v1.BilledSession=} opt_value
 * @param {number=} opt_index
 * @return {!proto.usage.v1.BilledSession}
 */
proto.usage.v1.ListBilledUsageResponse.prototype.addSessions = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 1, opt_value, proto.usage.v1.BilledSession, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.usage.v1.ListBilledUsageResponse} returns this
 */
proto.usage.v1.ListBilledUsageResponse.prototype.clearSessionsList = function() {
  return this.setSessionsList([]);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.usage.v1.BilledSession.prototype.toObject = function(opt_includeInstance) {
  return proto.usage.v1.BilledSession.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.usage.v1.BilledSession} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.BilledSession.toObject = function(includeInstance, msg) {
  var f, obj = {
    attributionId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    userId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    teamId: jspb.Message.getFieldWithDefault(msg, 3, ""),
    workspaceId: jspb.Message.getFieldWithDefault(msg, 4, ""),
    workspaceType: jspb.Message.getFieldWithDefault(msg, 5, ""),
    projectId: jspb.Message.getFieldWithDefault(msg, 6, ""),
    instanceId: jspb.Message.getFieldWithDefault(msg, 7, ""),
    workspaceClass: jspb.Message.getFieldWithDefault(msg, 8, ""),
    startTime: (f = msg.getStartTime()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    endTime: (f = msg.getEndTime()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    creditsDeprecated: jspb.Message.getFieldWithDefault(msg, 11, 0),
    credits: jspb.Message.getFloatingPointFieldWithDefault(msg, 12, 0.0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.usage.v1.BilledSession}
 */
proto.usage.v1.BilledSession.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.usage.v1.BilledSession;
  return proto.usage.v1.BilledSession.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.usage.v1.BilledSession} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.usage.v1.BilledSession}
 */
proto.usage.v1.BilledSession.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setAttributionId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setTeamId(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setWorkspaceId(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.setWorkspaceType(value);
      break;
    case 6:
      var value = /** @type {string} */ (reader.readString());
      msg.setProjectId(value);
      break;
    case 7:
      var value = /** @type {string} */ (reader.readString());
      msg.setInstanceId(value);
      break;
    case 8:
      var value = /** @type {string} */ (reader.readString());
      msg.setWorkspaceClass(value);
      break;
    case 9:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setStartTime(value);
      break;
    case 10:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setEndTime(value);
      break;
    case 11:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setCreditsDeprecated(value);
      break;
    case 12:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setCredits(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.usage.v1.BilledSession.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.usage.v1.BilledSession.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.usage.v1.BilledSession} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.BilledSession.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getAttributionId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getTeamId();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getWorkspaceId();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getWorkspaceType();
  if (f.length > 0) {
    writer.writeString(
      5,
      f
    );
  }
  f = message.getProjectId();
  if (f.length > 0) {
    writer.writeString(
      6,
      f
    );
  }
  f = message.getInstanceId();
  if (f.length > 0) {
    writer.writeString(
      7,
      f
    );
  }
  f = message.getWorkspaceClass();
  if (f.length > 0) {
    writer.writeString(
      8,
      f
    );
  }
  f = message.getStartTime();
  if (f != null) {
    writer.writeMessage(
      9,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getEndTime();
  if (f != null) {
    writer.writeMessage(
      10,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getCreditsDeprecated();
  if (f !== 0) {
    writer.writeInt64(
      11,
      f
    );
  }
  f = message.getCredits();
  if (f !== 0.0) {
    writer.writeDouble(
      12,
      f
    );
  }
};


/**
 * optional string attribution_id = 1;
 * @return {string}
 */
proto.usage.v1.BilledSession.prototype.getAttributionId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.BilledSession} returns this
 */
proto.usage.v1.BilledSession.prototype.setAttributionId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string user_id = 2;
 * @return {string}
 */
proto.usage.v1.BilledSession.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.BilledSession} returns this
 */
proto.usage.v1.BilledSession.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string team_id = 3;
 * @return {string}
 */
proto.usage.v1.BilledSession.prototype.getTeamId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.BilledSession} returns this
 */
proto.usage.v1.BilledSession.prototype.setTeamId = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string workspace_id = 4;
 * @return {string}
 */
proto.usage.v1.BilledSession.prototype.getWorkspaceId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.BilledSession} returns this
 */
proto.usage.v1.BilledSession.prototype.setWorkspaceId = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional string workspace_type = 5;
 * @return {string}
 */
proto.usage.v1.BilledSession.prototype.getWorkspaceType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 5, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.BilledSession} returns this
 */
proto.usage.v1.BilledSession.prototype.setWorkspaceType = function(value) {
  return jspb.Message.setProto3StringField(this, 5, value);
};


/**
 * optional string project_id = 6;
 * @return {string}
 */
proto.usage.v1.BilledSession.prototype.getProjectId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 6, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.BilledSession} returns this
 */
proto.usage.v1.BilledSession.prototype.setProjectId = function(value) {
  return jspb.Message.setProto3StringField(this, 6, value);
};


/**
 * optional string instance_id = 7;
 * @return {string}
 */
proto.usage.v1.BilledSession.prototype.getInstanceId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 7, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.BilledSession} returns this
 */
proto.usage.v1.BilledSession.prototype.setInstanceId = function(value) {
  return jspb.Message.setProto3StringField(this, 7, value);
};


/**
 * optional string workspace_class = 8;
 * @return {string}
 */
proto.usage.v1.BilledSession.prototype.getWorkspaceClass = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 8, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.BilledSession} returns this
 */
proto.usage.v1.BilledSession.prototype.setWorkspaceClass = function(value) {
  return jspb.Message.setProto3StringField(this, 8, value);
};


/**
 * optional google.protobuf.Timestamp start_time = 9;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.usage.v1.BilledSession.prototype.getStartTime = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 9));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.usage.v1.BilledSession} returns this
*/
proto.usage.v1.BilledSession.prototype.setStartTime = function(value) {
  return jspb.Message.setWrapperField(this, 9, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.usage.v1.BilledSession} returns this
 */
proto.usage.v1.BilledSession.prototype.clearStartTime = function() {
  return this.setStartTime(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.usage.v1.BilledSession.prototype.hasStartTime = function() {
  return jspb.Message.getField(this, 9) != null;
};


/**
 * optional google.protobuf.Timestamp end_time = 10;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.usage.v1.BilledSession.prototype.getEndTime = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 10));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.usage.v1.BilledSession} returns this
*/
proto.usage.v1.BilledSession.prototype.setEndTime = function(value) {
  return jspb.Message.setWrapperField(this, 10, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.usage.v1.BilledSession} returns this
 */
proto.usage.v1.BilledSession.prototype.clearEndTime = function() {
  return this.setEndTime(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.usage.v1.BilledSession.prototype.hasEndTime = function() {
  return jspb.Message.getField(this, 10) != null;
};


/**
 * optional int64 credits_deprecated = 11;
 * @return {number}
 */
proto.usage.v1.BilledSession.prototype.getCreditsDeprecated = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 11, 0));
};


/**
 * @param {number} value
 * @return {!proto.usage.v1.BilledSession} returns this
 */
proto.usage.v1.BilledSession.prototype.setCreditsDeprecated = function(value) {
  return jspb.Message.setProto3IntField(this, 11, value);
};


/**
 * optional double credits = 12;
 * @return {number}
 */
proto.usage.v1.BilledSession.prototype.getCredits = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 12, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.usage.v1.BilledSession} returns this
 */
proto.usage.v1.BilledSession.prototype.setCredits = function(value) {
  return jspb.Message.setProto3FloatField(this, 12, value);
};


goog.object.extend(exports, proto.usage.v1);
