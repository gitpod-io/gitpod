/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// source: usage/v1/billing.proto
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
var usage_v1_usage_pb = require('../../usage/v1/usage_pb.js');
goog.object.extend(proto, usage_v1_usage_pb);
goog.exportSymbol('proto.usage.v1.FinalizeInvoiceRequest', null, global);
goog.exportSymbol('proto.usage.v1.FinalizeInvoiceResponse', null, global);
goog.exportSymbol('proto.usage.v1.GetLatestInvoiceRequest', null, global);
goog.exportSymbol('proto.usage.v1.GetLatestInvoiceRequest.IdentifierCase', null, global);
goog.exportSymbol('proto.usage.v1.GetLatestInvoiceResponse', null, global);
goog.exportSymbol('proto.usage.v1.UpdateInvoicesRequest', null, global);
goog.exportSymbol('proto.usage.v1.UpdateInvoicesResponse', null, global);
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
proto.usage.v1.UpdateInvoicesRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.usage.v1.UpdateInvoicesRequest.repeatedFields_, null);
};
goog.inherits(proto.usage.v1.UpdateInvoicesRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.usage.v1.UpdateInvoicesRequest.displayName = 'proto.usage.v1.UpdateInvoicesRequest';
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
proto.usage.v1.UpdateInvoicesResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.usage.v1.UpdateInvoicesResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.usage.v1.UpdateInvoicesResponse.displayName = 'proto.usage.v1.UpdateInvoicesResponse';
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
proto.usage.v1.GetLatestInvoiceRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, proto.usage.v1.GetLatestInvoiceRequest.oneofGroups_);
};
goog.inherits(proto.usage.v1.GetLatestInvoiceRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.usage.v1.GetLatestInvoiceRequest.displayName = 'proto.usage.v1.GetLatestInvoiceRequest';
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
proto.usage.v1.GetLatestInvoiceResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.usage.v1.GetLatestInvoiceResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.usage.v1.GetLatestInvoiceResponse.displayName = 'proto.usage.v1.GetLatestInvoiceResponse';
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
proto.usage.v1.FinalizeInvoiceRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.usage.v1.FinalizeInvoiceRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.usage.v1.FinalizeInvoiceRequest.displayName = 'proto.usage.v1.FinalizeInvoiceRequest';
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
proto.usage.v1.FinalizeInvoiceResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.usage.v1.FinalizeInvoiceResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.usage.v1.FinalizeInvoiceResponse.displayName = 'proto.usage.v1.FinalizeInvoiceResponse';
}

/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.usage.v1.UpdateInvoicesRequest.repeatedFields_ = [3];



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
proto.usage.v1.UpdateInvoicesRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.usage.v1.UpdateInvoicesRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.usage.v1.UpdateInvoicesRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.UpdateInvoicesRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    startTime: (f = msg.getStartTime()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    endTime: (f = msg.getEndTime()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    sessionsList: jspb.Message.toObjectList(msg.getSessionsList(),
    usage_v1_usage_pb.BilledSession.toObject, includeInstance)
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
 * @return {!proto.usage.v1.UpdateInvoicesRequest}
 */
proto.usage.v1.UpdateInvoicesRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.usage.v1.UpdateInvoicesRequest;
  return proto.usage.v1.UpdateInvoicesRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.usage.v1.UpdateInvoicesRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.usage.v1.UpdateInvoicesRequest}
 */
proto.usage.v1.UpdateInvoicesRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setStartTime(value);
      break;
    case 2:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setEndTime(value);
      break;
    case 3:
      var value = new usage_v1_usage_pb.BilledSession;
      reader.readMessage(value,usage_v1_usage_pb.BilledSession.deserializeBinaryFromReader);
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
proto.usage.v1.UpdateInvoicesRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.usage.v1.UpdateInvoicesRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.usage.v1.UpdateInvoicesRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.UpdateInvoicesRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getStartTime();
  if (f != null) {
    writer.writeMessage(
      1,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getEndTime();
  if (f != null) {
    writer.writeMessage(
      2,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getSessionsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      3,
      f,
      usage_v1_usage_pb.BilledSession.serializeBinaryToWriter
    );
  }
};


/**
 * optional google.protobuf.Timestamp start_time = 1;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.usage.v1.UpdateInvoicesRequest.prototype.getStartTime = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 1));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.usage.v1.UpdateInvoicesRequest} returns this
*/
proto.usage.v1.UpdateInvoicesRequest.prototype.setStartTime = function(value) {
  return jspb.Message.setWrapperField(this, 1, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.usage.v1.UpdateInvoicesRequest} returns this
 */
proto.usage.v1.UpdateInvoicesRequest.prototype.clearStartTime = function() {
  return this.setStartTime(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.usage.v1.UpdateInvoicesRequest.prototype.hasStartTime = function() {
  return jspb.Message.getField(this, 1) != null;
};


/**
 * optional google.protobuf.Timestamp end_time = 2;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.usage.v1.UpdateInvoicesRequest.prototype.getEndTime = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 2));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.usage.v1.UpdateInvoicesRequest} returns this
*/
proto.usage.v1.UpdateInvoicesRequest.prototype.setEndTime = function(value) {
  return jspb.Message.setWrapperField(this, 2, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.usage.v1.UpdateInvoicesRequest} returns this
 */
proto.usage.v1.UpdateInvoicesRequest.prototype.clearEndTime = function() {
  return this.setEndTime(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.usage.v1.UpdateInvoicesRequest.prototype.hasEndTime = function() {
  return jspb.Message.getField(this, 2) != null;
};


/**
 * repeated BilledSession sessions = 3;
 * @return {!Array<!proto.usage.v1.BilledSession>}
 */
proto.usage.v1.UpdateInvoicesRequest.prototype.getSessionsList = function() {
  return /** @type{!Array<!proto.usage.v1.BilledSession>} */ (
    jspb.Message.getRepeatedWrapperField(this, usage_v1_usage_pb.BilledSession, 3));
};


/**
 * @param {!Array<!proto.usage.v1.BilledSession>} value
 * @return {!proto.usage.v1.UpdateInvoicesRequest} returns this
*/
proto.usage.v1.UpdateInvoicesRequest.prototype.setSessionsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 3, value);
};


/**
 * @param {!proto.usage.v1.BilledSession=} opt_value
 * @param {number=} opt_index
 * @return {!proto.usage.v1.BilledSession}
 */
proto.usage.v1.UpdateInvoicesRequest.prototype.addSessions = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 3, opt_value, proto.usage.v1.BilledSession, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.usage.v1.UpdateInvoicesRequest} returns this
 */
proto.usage.v1.UpdateInvoicesRequest.prototype.clearSessionsList = function() {
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
proto.usage.v1.UpdateInvoicesResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.usage.v1.UpdateInvoicesResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.usage.v1.UpdateInvoicesResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.UpdateInvoicesResponse.toObject = function(includeInstance, msg) {
  var f, obj = {

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
 * @return {!proto.usage.v1.UpdateInvoicesResponse}
 */
proto.usage.v1.UpdateInvoicesResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.usage.v1.UpdateInvoicesResponse;
  return proto.usage.v1.UpdateInvoicesResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.usage.v1.UpdateInvoicesResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.usage.v1.UpdateInvoicesResponse}
 */
proto.usage.v1.UpdateInvoicesResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
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
proto.usage.v1.UpdateInvoicesResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.usage.v1.UpdateInvoicesResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.usage.v1.UpdateInvoicesResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.UpdateInvoicesResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
};



/**
 * Oneof group definitions for this message. Each group defines the field
 * numbers belonging to that group. When of these fields' value is set, all
 * other fields in the group are cleared. During deserialization, if multiple
 * fields are encountered for a group, only the last value seen will be kept.
 * @private {!Array<!Array<number>>}
 * @const
 */
proto.usage.v1.GetLatestInvoiceRequest.oneofGroups_ = [[1,2]];

/**
 * @enum {number}
 */
proto.usage.v1.GetLatestInvoiceRequest.IdentifierCase = {
  IDENTIFIER_NOT_SET: 0,
  TEAM_ID: 1,
  USER_ID: 2
};

/**
 * @return {proto.usage.v1.GetLatestInvoiceRequest.IdentifierCase}
 */
proto.usage.v1.GetLatestInvoiceRequest.prototype.getIdentifierCase = function() {
  return /** @type {proto.usage.v1.GetLatestInvoiceRequest.IdentifierCase} */(jspb.Message.computeOneofCase(this, proto.usage.v1.GetLatestInvoiceRequest.oneofGroups_[0]));
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
proto.usage.v1.GetLatestInvoiceRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.usage.v1.GetLatestInvoiceRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.usage.v1.GetLatestInvoiceRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.GetLatestInvoiceRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    teamId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    userId: jspb.Message.getFieldWithDefault(msg, 2, "")
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
 * @return {!proto.usage.v1.GetLatestInvoiceRequest}
 */
proto.usage.v1.GetLatestInvoiceRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.usage.v1.GetLatestInvoiceRequest;
  return proto.usage.v1.GetLatestInvoiceRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.usage.v1.GetLatestInvoiceRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.usage.v1.GetLatestInvoiceRequest}
 */
proto.usage.v1.GetLatestInvoiceRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setTeamId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
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
proto.usage.v1.GetLatestInvoiceRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.usage.v1.GetLatestInvoiceRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.usage.v1.GetLatestInvoiceRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.GetLatestInvoiceRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = /** @type {string} */ (jspb.Message.getField(message, 1));
  if (f != null) {
    writer.writeString(
      1,
      f
    );
  }
  f = /** @type {string} */ (jspb.Message.getField(message, 2));
  if (f != null) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional string team_id = 1;
 * @return {string}
 */
proto.usage.v1.GetLatestInvoiceRequest.prototype.getTeamId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.GetLatestInvoiceRequest} returns this
 */
proto.usage.v1.GetLatestInvoiceRequest.prototype.setTeamId = function(value) {
  return jspb.Message.setOneofField(this, 1, proto.usage.v1.GetLatestInvoiceRequest.oneofGroups_[0], value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.usage.v1.GetLatestInvoiceRequest} returns this
 */
proto.usage.v1.GetLatestInvoiceRequest.prototype.clearTeamId = function() {
  return jspb.Message.setOneofField(this, 1, proto.usage.v1.GetLatestInvoiceRequest.oneofGroups_[0], undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.usage.v1.GetLatestInvoiceRequest.prototype.hasTeamId = function() {
  return jspb.Message.getField(this, 1) != null;
};


/**
 * optional string user_id = 2;
 * @return {string}
 */
proto.usage.v1.GetLatestInvoiceRequest.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.GetLatestInvoiceRequest} returns this
 */
proto.usage.v1.GetLatestInvoiceRequest.prototype.setUserId = function(value) {
  return jspb.Message.setOneofField(this, 2, proto.usage.v1.GetLatestInvoiceRequest.oneofGroups_[0], value);
};


/**
 * Clears the field making it undefined.
 * @return {!proto.usage.v1.GetLatestInvoiceRequest} returns this
 */
proto.usage.v1.GetLatestInvoiceRequest.prototype.clearUserId = function() {
  return jspb.Message.setOneofField(this, 2, proto.usage.v1.GetLatestInvoiceRequest.oneofGroups_[0], undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.usage.v1.GetLatestInvoiceRequest.prototype.hasUserId = function() {
  return jspb.Message.getField(this, 2) != null;
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
proto.usage.v1.GetLatestInvoiceResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.usage.v1.GetLatestInvoiceResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.usage.v1.GetLatestInvoiceResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.GetLatestInvoiceResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    invoiceId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    currency: jspb.Message.getFieldWithDefault(msg, 2, ""),
    amount: jspb.Message.getFloatingPointFieldWithDefault(msg, 3, 0.0)
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
 * @return {!proto.usage.v1.GetLatestInvoiceResponse}
 */
proto.usage.v1.GetLatestInvoiceResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.usage.v1.GetLatestInvoiceResponse;
  return proto.usage.v1.GetLatestInvoiceResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.usage.v1.GetLatestInvoiceResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.usage.v1.GetLatestInvoiceResponse}
 */
proto.usage.v1.GetLatestInvoiceResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setInvoiceId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setCurrency(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setAmount(value);
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
proto.usage.v1.GetLatestInvoiceResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.usage.v1.GetLatestInvoiceResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.usage.v1.GetLatestInvoiceResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.GetLatestInvoiceResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getInvoiceId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getCurrency();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getAmount();
  if (f !== 0.0) {
    writer.writeDouble(
      3,
      f
    );
  }
};


/**
 * optional string invoice_id = 1;
 * @return {string}
 */
proto.usage.v1.GetLatestInvoiceResponse.prototype.getInvoiceId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.GetLatestInvoiceResponse} returns this
 */
proto.usage.v1.GetLatestInvoiceResponse.prototype.setInvoiceId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string currency = 2;
 * @return {string}
 */
proto.usage.v1.GetLatestInvoiceResponse.prototype.getCurrency = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.GetLatestInvoiceResponse} returns this
 */
proto.usage.v1.GetLatestInvoiceResponse.prototype.setCurrency = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional double amount = 3;
 * @return {number}
 */
proto.usage.v1.GetLatestInvoiceResponse.prototype.getAmount = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 3, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.usage.v1.GetLatestInvoiceResponse} returns this
 */
proto.usage.v1.GetLatestInvoiceResponse.prototype.setAmount = function(value) {
  return jspb.Message.setProto3FloatField(this, 3, value);
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
proto.usage.v1.FinalizeInvoiceRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.usage.v1.FinalizeInvoiceRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.usage.v1.FinalizeInvoiceRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.FinalizeInvoiceRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    invoiceId: jspb.Message.getFieldWithDefault(msg, 1, "")
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
 * @return {!proto.usage.v1.FinalizeInvoiceRequest}
 */
proto.usage.v1.FinalizeInvoiceRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.usage.v1.FinalizeInvoiceRequest;
  return proto.usage.v1.FinalizeInvoiceRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.usage.v1.FinalizeInvoiceRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.usage.v1.FinalizeInvoiceRequest}
 */
proto.usage.v1.FinalizeInvoiceRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setInvoiceId(value);
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
proto.usage.v1.FinalizeInvoiceRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.usage.v1.FinalizeInvoiceRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.usage.v1.FinalizeInvoiceRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.FinalizeInvoiceRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getInvoiceId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
};


/**
 * optional string invoice_id = 1;
 * @return {string}
 */
proto.usage.v1.FinalizeInvoiceRequest.prototype.getInvoiceId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.usage.v1.FinalizeInvoiceRequest} returns this
 */
proto.usage.v1.FinalizeInvoiceRequest.prototype.setInvoiceId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
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
proto.usage.v1.FinalizeInvoiceResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.usage.v1.FinalizeInvoiceResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.usage.v1.FinalizeInvoiceResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.FinalizeInvoiceResponse.toObject = function(includeInstance, msg) {
  var f, obj = {

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
 * @return {!proto.usage.v1.FinalizeInvoiceResponse}
 */
proto.usage.v1.FinalizeInvoiceResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.usage.v1.FinalizeInvoiceResponse;
  return proto.usage.v1.FinalizeInvoiceResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.usage.v1.FinalizeInvoiceResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.usage.v1.FinalizeInvoiceResponse}
 */
proto.usage.v1.FinalizeInvoiceResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
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
proto.usage.v1.FinalizeInvoiceResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.usage.v1.FinalizeInvoiceResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.usage.v1.FinalizeInvoiceResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.usage.v1.FinalizeInvoiceResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
};


goog.object.extend(exports, proto.usage.v1);
