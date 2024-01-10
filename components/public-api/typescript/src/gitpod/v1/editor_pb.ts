/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-es v1.3.3 with parameter "target=ts"
// @generated from file gitpod/v1/editor.proto (package gitpod.v1, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import type { BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage } from "@bufbuild/protobuf";
import { Message, proto3 } from "@bufbuild/protobuf";

/**
 * @generated from message gitpod.v1.EditorReference
 */
export class EditorReference extends Message<EditorReference> {
  /**
   * @generated from field: string name = 1;
   */
  name = "";

  /**
   * @generated from field: string version = 2;
   */
  version = "";

  constructor(data?: PartialMessage<EditorReference>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.EditorReference";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "name", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "version", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): EditorReference {
    return new EditorReference().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): EditorReference {
    return new EditorReference().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): EditorReference {
    return new EditorReference().fromJsonString(jsonString, options);
  }

  static equals(a: EditorReference | PlainMessage<EditorReference> | undefined, b: EditorReference | PlainMessage<EditorReference> | undefined): boolean {
    return proto3.util.equals(EditorReference, a, b);
  }
}
