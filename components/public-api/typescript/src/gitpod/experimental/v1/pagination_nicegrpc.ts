/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import * as _m0 from "protobufjs/minimal";

export const protobufPackage = "gitpod.experimental.v1";

export interface Pagination {
  /**
   * Page size is the maximum number of results to retrieve per page.
   * Defaults to 25. Maximum 100.
   */
  pageSize: number;
  /**
   * Page is the page number of results to retrieve.
   * The first page starts at 1.
   * Defaults to 1.
   */
  page: number;
}

function createBasePagination(): Pagination {
  return { pageSize: 0, page: 0 };
}

export const Pagination = {
  encode(message: Pagination, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pageSize !== 0) {
      writer.uint32(8).int32(message.pageSize);
    }
    if (message.page !== 0) {
      writer.uint32(16).int32(message.page);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Pagination {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePagination();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pageSize = reader.int32();
          break;
        case 2:
          message.page = reader.int32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Pagination {
    return {
      pageSize: isSet(object.pageSize) ? Number(object.pageSize) : 0,
      page: isSet(object.page) ? Number(object.page) : 0,
    };
  },

  toJSON(message: Pagination): unknown {
    const obj: any = {};
    message.pageSize !== undefined && (obj.pageSize = Math.round(message.pageSize));
    message.page !== undefined && (obj.page = Math.round(message.page));
    return obj;
  },

  create(base?: DeepPartial<Pagination>): Pagination {
    return Pagination.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<Pagination>): Pagination {
    const message = createBasePagination();
    message.pageSize = object.pageSize ?? 0;
    message.page = object.page ?? 0;
    return message;
  },
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
