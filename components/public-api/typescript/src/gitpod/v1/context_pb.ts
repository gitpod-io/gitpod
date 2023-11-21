/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-es v1.3.3 with parameter "target=ts"
// @generated from file gitpod/v1/context.proto (package gitpod.v1, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import type { BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage } from "@bufbuild/protobuf";
import { Message, proto3 } from "@bufbuild/protobuf";

/**
 * @generated from message gitpod.v1.ParseContextRequest
 */
export class ParseContextRequest extends Message<ParseContextRequest> {
  /**
   * @generated from field: string url = 1;
   */
  url = "";

  constructor(data?: PartialMessage<ParseContextRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.ParseContextRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "url", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ParseContextRequest {
    return new ParseContextRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ParseContextRequest {
    return new ParseContextRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ParseContextRequest {
    return new ParseContextRequest().fromJsonString(jsonString, options);
  }

  static equals(a: ParseContextRequest | PlainMessage<ParseContextRequest> | undefined, b: ParseContextRequest | PlainMessage<ParseContextRequest> | undefined): boolean {
    return proto3.util.equals(ParseContextRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.ParseContextResponse
 */
export class ParseContextResponse extends Message<ParseContextResponse> {
  /**
   * @generated from field: gitpod.v1.Context context = 1;
   */
  context?: Context;

  constructor(data?: PartialMessage<ParseContextResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.ParseContextResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "context", kind: "message", T: Context },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ParseContextResponse {
    return new ParseContextResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ParseContextResponse {
    return new ParseContextResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ParseContextResponse {
    return new ParseContextResponse().fromJsonString(jsonString, options);
  }

  static equals(a: ParseContextResponse | PlainMessage<ParseContextResponse> | undefined, b: ParseContextResponse | PlainMessage<ParseContextResponse> | undefined): boolean {
    return proto3.util.equals(ParseContextResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.Context
 */
export class Context extends Message<Context> {
  /**
   * @generated from field: string title = 1;
   */
  title = "";

  /**
   * @generated from field: string normalized_url = 2;
   */
  normalizedUrl = "";

  /**
   * @generated from field: string ref = 3;
   */
  ref = "";

  constructor(data?: PartialMessage<Context>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.Context";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "title", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "normalized_url", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 3, name: "ref", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): Context {
    return new Context().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): Context {
    return new Context().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): Context {
    return new Context().fromJsonString(jsonString, options);
  }

  static equals(a: Context | PlainMessage<Context> | undefined, b: Context | PlainMessage<Context> | undefined): boolean {
    return proto3.util.equals(Context, a, b);
  }
}