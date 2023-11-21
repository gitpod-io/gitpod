/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-es v1.3.3 with parameter "target=ts"
// @generated from file gitpod/v1/prebuild.proto (package gitpod.v1, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import type {
    BinaryReadOptions,
    FieldList,
    JsonReadOptions,
    JsonValue,
    PartialMessage,
    PlainMessage,
} from "@bufbuild/protobuf";
import { Message, proto3, Timestamp } from "@bufbuild/protobuf";
import { PaginationRequest, PaginationResponse } from "./pagination_pb.js";
import { Commit } from "./scm_pb.js";

/**
 * @generated from message gitpod.v1.GetPrebuildRequest
 */
export class GetPrebuildRequest extends Message<GetPrebuildRequest> {
    /**
     * @generated from field: string prebuild_id = 1;
     */
    prebuildId = "";

    constructor(data?: PartialMessage<GetPrebuildRequest>) {
        super();
        proto3.util.initPartial(data, this);
    }

    static readonly runtime: typeof proto3 = proto3;
    static readonly typeName = "gitpod.v1.GetPrebuildRequest";
    static readonly fields: FieldList = proto3.util.newFieldList(() => [
        { no: 1, name: "prebuild_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    ]);

    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetPrebuildRequest {
        return new GetPrebuildRequest().fromBinary(bytes, options);
    }

    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetPrebuildRequest {
        return new GetPrebuildRequest().fromJson(jsonValue, options);
    }

    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetPrebuildRequest {
        return new GetPrebuildRequest().fromJsonString(jsonString, options);
    }

    static equals(
        a: GetPrebuildRequest | PlainMessage<GetPrebuildRequest> | undefined,
        b: GetPrebuildRequest | PlainMessage<GetPrebuildRequest> | undefined,
    ): boolean {
        return proto3.util.equals(GetPrebuildRequest, a, b);
    }
}

/**
 * @generated from message gitpod.v1.GetPrebuildResponse
 */
export class GetPrebuildResponse extends Message<GetPrebuildResponse> {
    /**
     * @generated from field: gitpod.v1.Prebuild prebuild = 1;
     */
    prebuild?: Prebuild;

    constructor(data?: PartialMessage<GetPrebuildResponse>) {
        super();
        proto3.util.initPartial(data, this);
    }

    static readonly runtime: typeof proto3 = proto3;
    static readonly typeName = "gitpod.v1.GetPrebuildResponse";
    static readonly fields: FieldList = proto3.util.newFieldList(() => [
        { no: 1, name: "prebuild", kind: "message", T: Prebuild },
    ]);

    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetPrebuildResponse {
        return new GetPrebuildResponse().fromBinary(bytes, options);
    }

    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetPrebuildResponse {
        return new GetPrebuildResponse().fromJson(jsonValue, options);
    }

    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetPrebuildResponse {
        return new GetPrebuildResponse().fromJsonString(jsonString, options);
    }

    static equals(
        a: GetPrebuildResponse | PlainMessage<GetPrebuildResponse> | undefined,
        b: GetPrebuildResponse | PlainMessage<GetPrebuildResponse> | undefined,
    ): boolean {
        return proto3.util.equals(GetPrebuildResponse, a, b);
    }
}

/**
 * @generated from message gitpod.v1.ListPrebuildsRequest
 */
export class ListPrebuildsRequest extends Message<ListPrebuildsRequest> {
    /**
     * @generated from field: gitpod.v1.PaginationRequest pagination = 1;
     */
    pagination?: PaginationRequest;

    /**
     * it is for backward compatiblity with the current dashboard, use prebuild_id instead
     *
     * @generated from field: string workspace_id = 2 [deprecated = true];
     * @deprecated
     */
    workspaceId = "";

    /**
     * @generated from field: string configuration_id = 3;
     */
    configurationId = "";

    /**
     * @generated from field: string git_ref = 4;
     */
    gitRef = "";

    constructor(data?: PartialMessage<ListPrebuildsRequest>) {
        super();
        proto3.util.initPartial(data, this);
    }

    static readonly runtime: typeof proto3 = proto3;
    static readonly typeName = "gitpod.v1.ListPrebuildsRequest";
    static readonly fields: FieldList = proto3.util.newFieldList(() => [
        { no: 1, name: "pagination", kind: "message", T: PaginationRequest },
        { no: 2, name: "workspace_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
        { no: 3, name: "configuration_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
        { no: 4, name: "git_ref", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    ]);

    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListPrebuildsRequest {
        return new ListPrebuildsRequest().fromBinary(bytes, options);
    }

    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListPrebuildsRequest {
        return new ListPrebuildsRequest().fromJson(jsonValue, options);
    }

    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListPrebuildsRequest {
        return new ListPrebuildsRequest().fromJsonString(jsonString, options);
    }

    static equals(
        a: ListPrebuildsRequest | PlainMessage<ListPrebuildsRequest> | undefined,
        b: ListPrebuildsRequest | PlainMessage<ListPrebuildsRequest> | undefined,
    ): boolean {
        return proto3.util.equals(ListPrebuildsRequest, a, b);
    }
}

/**
 * @generated from message gitpod.v1.ListPrebuildsResponse
 */
export class ListPrebuildsResponse extends Message<ListPrebuildsResponse> {
    /**
     * @generated from field: gitpod.v1.PaginationResponse pagination = 1;
     */
    pagination?: PaginationResponse;

    /**
     * @generated from field: repeated gitpod.v1.Prebuild prebuilds = 2;
     */
    prebuilds: Prebuild[] = [];

    constructor(data?: PartialMessage<ListPrebuildsResponse>) {
        super();
        proto3.util.initPartial(data, this);
    }

    static readonly runtime: typeof proto3 = proto3;
    static readonly typeName = "gitpod.v1.ListPrebuildsResponse";
    static readonly fields: FieldList = proto3.util.newFieldList(() => [
        { no: 1, name: "pagination", kind: "message", T: PaginationResponse },
        { no: 2, name: "prebuilds", kind: "message", T: Prebuild, repeated: true },
    ]);

    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListPrebuildsResponse {
        return new ListPrebuildsResponse().fromBinary(bytes, options);
    }

    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListPrebuildsResponse {
        return new ListPrebuildsResponse().fromJson(jsonValue, options);
    }

    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListPrebuildsResponse {
        return new ListPrebuildsResponse().fromJsonString(jsonString, options);
    }

    static equals(
        a: ListPrebuildsResponse | PlainMessage<ListPrebuildsResponse> | undefined,
        b: ListPrebuildsResponse | PlainMessage<ListPrebuildsResponse> | undefined,
    ): boolean {
        return proto3.util.equals(ListPrebuildsResponse, a, b);
    }
}

/**
 * @generated from message gitpod.v1.StartPrebuildRequest
 */
export class StartPrebuildRequest extends Message<StartPrebuildRequest> {
    /**
     * @generated from field: string configuration_id = 1;
     */
    configurationId = "";

    /**
     * @generated from field: string git_ref = 2;
     */
    gitRef = "";

    constructor(data?: PartialMessage<StartPrebuildRequest>) {
        super();
        proto3.util.initPartial(data, this);
    }

    static readonly runtime: typeof proto3 = proto3;
    static readonly typeName = "gitpod.v1.StartPrebuildRequest";
    static readonly fields: FieldList = proto3.util.newFieldList(() => [
        { no: 1, name: "configuration_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
        { no: 2, name: "git_ref", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    ]);

    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): StartPrebuildRequest {
        return new StartPrebuildRequest().fromBinary(bytes, options);
    }

    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): StartPrebuildRequest {
        return new StartPrebuildRequest().fromJson(jsonValue, options);
    }

    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): StartPrebuildRequest {
        return new StartPrebuildRequest().fromJsonString(jsonString, options);
    }

    static equals(
        a: StartPrebuildRequest | PlainMessage<StartPrebuildRequest> | undefined,
        b: StartPrebuildRequest | PlainMessage<StartPrebuildRequest> | undefined,
    ): boolean {
        return proto3.util.equals(StartPrebuildRequest, a, b);
    }
}

/**
 * @generated from message gitpod.v1.StartPrebuildResponse
 */
export class StartPrebuildResponse extends Message<StartPrebuildResponse> {
    /**
     * @generated from field: string prebuild_id = 1;
     */
    prebuildId = "";

    constructor(data?: PartialMessage<StartPrebuildResponse>) {
        super();
        proto3.util.initPartial(data, this);
    }

    static readonly runtime: typeof proto3 = proto3;
    static readonly typeName = "gitpod.v1.StartPrebuildResponse";
    static readonly fields: FieldList = proto3.util.newFieldList(() => [
        { no: 1, name: "prebuild_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    ]);

    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): StartPrebuildResponse {
        return new StartPrebuildResponse().fromBinary(bytes, options);
    }

    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): StartPrebuildResponse {
        return new StartPrebuildResponse().fromJson(jsonValue, options);
    }

    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): StartPrebuildResponse {
        return new StartPrebuildResponse().fromJsonString(jsonString, options);
    }

    static equals(
        a: StartPrebuildResponse | PlainMessage<StartPrebuildResponse> | undefined,
        b: StartPrebuildResponse | PlainMessage<StartPrebuildResponse> | undefined,
    ): boolean {
        return proto3.util.equals(StartPrebuildResponse, a, b);
    }
}

/**
 * @generated from message gitpod.v1.CancelPrebuildRequest
 */
export class CancelPrebuildRequest extends Message<CancelPrebuildRequest> {
    /**
     * @generated from field: string prebuild_id = 1;
     */
    prebuildId = "";

    constructor(data?: PartialMessage<CancelPrebuildRequest>) {
        super();
        proto3.util.initPartial(data, this);
    }

    static readonly runtime: typeof proto3 = proto3;
    static readonly typeName = "gitpod.v1.CancelPrebuildRequest";
    static readonly fields: FieldList = proto3.util.newFieldList(() => [
        { no: 1, name: "prebuild_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    ]);

    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CancelPrebuildRequest {
        return new CancelPrebuildRequest().fromBinary(bytes, options);
    }

    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CancelPrebuildRequest {
        return new CancelPrebuildRequest().fromJson(jsonValue, options);
    }

    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CancelPrebuildRequest {
        return new CancelPrebuildRequest().fromJsonString(jsonString, options);
    }

    static equals(
        a: CancelPrebuildRequest | PlainMessage<CancelPrebuildRequest> | undefined,
        b: CancelPrebuildRequest | PlainMessage<CancelPrebuildRequest> | undefined,
    ): boolean {
        return proto3.util.equals(CancelPrebuildRequest, a, b);
    }
}

/**
 * @generated from message gitpod.v1.CancelPrebuildResponse
 */
export class CancelPrebuildResponse extends Message<CancelPrebuildResponse> {
    constructor(data?: PartialMessage<CancelPrebuildResponse>) {
        super();
        proto3.util.initPartial(data, this);
    }

    static readonly runtime: typeof proto3 = proto3;
    static readonly typeName = "gitpod.v1.CancelPrebuildResponse";
    static readonly fields: FieldList = proto3.util.newFieldList(() => []);

    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CancelPrebuildResponse {
        return new CancelPrebuildResponse().fromBinary(bytes, options);
    }

    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CancelPrebuildResponse {
        return new CancelPrebuildResponse().fromJson(jsonValue, options);
    }

    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CancelPrebuildResponse {
        return new CancelPrebuildResponse().fromJsonString(jsonString, options);
    }

    static equals(
        a: CancelPrebuildResponse | PlainMessage<CancelPrebuildResponse> | undefined,
        b: CancelPrebuildResponse | PlainMessage<CancelPrebuildResponse> | undefined,
    ): boolean {
        return proto3.util.equals(CancelPrebuildResponse, a, b);
    }
}

/**
 * @generated from message gitpod.v1.WatchPrebuildRequest
 */
export class WatchPrebuildRequest extends Message<WatchPrebuildRequest> {
    /**
     * @generated from oneof gitpod.v1.WatchPrebuildRequest.scope
     */
    scope:
        | {
              /**
               * @generated from field: string prebuild_id = 1;
               */
              value: string;
              case: "prebuildId";
          }
        | {
              /**
               * @generated from field: string configuration_id = 2;
               */
              value: string;
              case: "configurationId";
          }
        | { case: undefined; value?: undefined } = { case: undefined };

    constructor(data?: PartialMessage<WatchPrebuildRequest>) {
        super();
        proto3.util.initPartial(data, this);
    }

    static readonly runtime: typeof proto3 = proto3;
    static readonly typeName = "gitpod.v1.WatchPrebuildRequest";
    static readonly fields: FieldList = proto3.util.newFieldList(() => [
        { no: 1, name: "prebuild_id", kind: "scalar", T: 9 /* ScalarType.STRING */, oneof: "scope" },
        { no: 2, name: "configuration_id", kind: "scalar", T: 9 /* ScalarType.STRING */, oneof: "scope" },
    ]);

    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): WatchPrebuildRequest {
        return new WatchPrebuildRequest().fromBinary(bytes, options);
    }

    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): WatchPrebuildRequest {
        return new WatchPrebuildRequest().fromJson(jsonValue, options);
    }

    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): WatchPrebuildRequest {
        return new WatchPrebuildRequest().fromJsonString(jsonString, options);
    }

    static equals(
        a: WatchPrebuildRequest | PlainMessage<WatchPrebuildRequest> | undefined,
        b: WatchPrebuildRequest | PlainMessage<WatchPrebuildRequest> | undefined,
    ): boolean {
        return proto3.util.equals(WatchPrebuildRequest, a, b);
    }
}

/**
 * @generated from message gitpod.v1.WatchPrebuildResponse
 */
export class WatchPrebuildResponse extends Message<WatchPrebuildResponse> {
    /**
     * @generated from field: gitpod.v1.Prebuild prebuild = 1;
     */
    prebuild?: Prebuild;

    constructor(data?: PartialMessage<WatchPrebuildResponse>) {
        super();
        proto3.util.initPartial(data, this);
    }

    static readonly runtime: typeof proto3 = proto3;
    static readonly typeName = "gitpod.v1.WatchPrebuildResponse";
    static readonly fields: FieldList = proto3.util.newFieldList(() => [
        { no: 1, name: "prebuild", kind: "message", T: Prebuild },
    ]);

    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): WatchPrebuildResponse {
        return new WatchPrebuildResponse().fromBinary(bytes, options);
    }

    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): WatchPrebuildResponse {
        return new WatchPrebuildResponse().fromJson(jsonValue, options);
    }

    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): WatchPrebuildResponse {
        return new WatchPrebuildResponse().fromJsonString(jsonString, options);
    }

    static equals(
        a: WatchPrebuildResponse | PlainMessage<WatchPrebuildResponse> | undefined,
        b: WatchPrebuildResponse | PlainMessage<WatchPrebuildResponse> | undefined,
    ): boolean {
        return proto3.util.equals(WatchPrebuildResponse, a, b);
    }
}

/**
 * @generated from message gitpod.v1.Prebuild
 */
export class Prebuild extends Message<Prebuild> {
    /**
     * @generated from field: string id = 1;
     */
    id = "";

    /**
     * it is for backward compatiblity with the current dashboard, use id instead
     *
     * @generated from field: string workspace_id = 2 [deprecated = true];
     * @deprecated
     */
    workspaceId = "";

    /**
     * @generated from field: string based_on_prebuild_id = 3;
     */
    basedOnPrebuildId = "";

    /**
     * @generated from field: string configuration_id = 4;
     */
    configurationId = "";

    /**
     * @generated from field: string ref = 5;
     */
    ref = "";

    /**
     * @generated from field: gitpod.v1.Commit commit = 6;
     */
    commit?: Commit;

    /**
     * @generated from field: string context_url = 7;
     */
    contextUrl = "";

    /**
     * @generated from field: gitpod.v1.PrebuildStatus status = 8;
     */
    status?: PrebuildStatus;

    constructor(data?: PartialMessage<Prebuild>) {
        super();
        proto3.util.initPartial(data, this);
    }

    static readonly runtime: typeof proto3 = proto3;
    static readonly typeName = "gitpod.v1.Prebuild";
    static readonly fields: FieldList = proto3.util.newFieldList(() => [
        { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
        { no: 2, name: "workspace_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
        { no: 3, name: "based_on_prebuild_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
        { no: 4, name: "configuration_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
        { no: 5, name: "ref", kind: "scalar", T: 9 /* ScalarType.STRING */ },
        { no: 6, name: "commit", kind: "message", T: Commit },
        { no: 7, name: "context_url", kind: "scalar", T: 9 /* ScalarType.STRING */ },
        { no: 8, name: "status", kind: "message", T: PrebuildStatus },
    ]);

    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): Prebuild {
        return new Prebuild().fromBinary(bytes, options);
    }

    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): Prebuild {
        return new Prebuild().fromJson(jsonValue, options);
    }

    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): Prebuild {
        return new Prebuild().fromJsonString(jsonString, options);
    }

    static equals(
        a: Prebuild | PlainMessage<Prebuild> | undefined,
        b: Prebuild | PlainMessage<Prebuild> | undefined,
    ): boolean {
        return proto3.util.equals(Prebuild, a, b);
    }
}

/**
 * @generated from message gitpod.v1.PrebuildStatus
 */
export class PrebuildStatus extends Message<PrebuildStatus> {
    /**
     * @generated from field: gitpod.v1.PrebuildPhase phase = 1;
     */
    phase?: PrebuildPhase;

    /**
     * @generated from field: google.protobuf.Timestamp start_time = 2;
     */
    startTime?: Timestamp;

    /**
     * message is an optional human-readable message detailing the current phase
     *
     * @generated from field: string message = 3;
     */
    message = "";

    constructor(data?: PartialMessage<PrebuildStatus>) {
        super();
        proto3.util.initPartial(data, this);
    }

    static readonly runtime: typeof proto3 = proto3;
    static readonly typeName = "gitpod.v1.PrebuildStatus";
    static readonly fields: FieldList = proto3.util.newFieldList(() => [
        { no: 1, name: "phase", kind: "message", T: PrebuildPhase },
        { no: 2, name: "start_time", kind: "message", T: Timestamp },
        { no: 3, name: "message", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    ]);

    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): PrebuildStatus {
        return new PrebuildStatus().fromBinary(bytes, options);
    }

    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): PrebuildStatus {
        return new PrebuildStatus().fromJson(jsonValue, options);
    }

    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): PrebuildStatus {
        return new PrebuildStatus().fromJsonString(jsonString, options);
    }

    static equals(
        a: PrebuildStatus | PlainMessage<PrebuildStatus> | undefined,
        b: PrebuildStatus | PlainMessage<PrebuildStatus> | undefined,
    ): boolean {
        return proto3.util.equals(PrebuildStatus, a, b);
    }
}

/**
 * @generated from message gitpod.v1.PrebuildPhase
 */
export class PrebuildPhase extends Message<PrebuildPhase> {
    /**
     * @generated from field: gitpod.v1.PrebuildPhase.Phase name = 1;
     */
    name = PrebuildPhase_Phase.UNSPECIFIED;

    constructor(data?: PartialMessage<PrebuildPhase>) {
        super();
        proto3.util.initPartial(data, this);
    }

    static readonly runtime: typeof proto3 = proto3;
    static readonly typeName = "gitpod.v1.PrebuildPhase";
    static readonly fields: FieldList = proto3.util.newFieldList(() => [
        { no: 1, name: "name", kind: "enum", T: proto3.getEnumType(PrebuildPhase_Phase) },
    ]);

    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): PrebuildPhase {
        return new PrebuildPhase().fromBinary(bytes, options);
    }

    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): PrebuildPhase {
        return new PrebuildPhase().fromJson(jsonValue, options);
    }

    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): PrebuildPhase {
        return new PrebuildPhase().fromJsonString(jsonString, options);
    }

    static equals(
        a: PrebuildPhase | PlainMessage<PrebuildPhase> | undefined,
        b: PrebuildPhase | PlainMessage<PrebuildPhase> | undefined,
    ): boolean {
        return proto3.util.equals(PrebuildPhase, a, b);
    }
}

/**
 * @generated from enum gitpod.v1.PrebuildPhase.Phase
 */
export enum PrebuildPhase_Phase {
    /**
     * @generated from enum value: PHASE_UNSPECIFIED = 0;
     */
    UNSPECIFIED = 0,

    /**
     * @generated from enum value: PHASE_QUEUED = 1;
     */
    QUEUED = 1,

    /**
     * @generated from enum value: PHASE_BUILDING = 2;
     */
    BUILDING = 2,

    /**
     * @generated from enum value: PHASE_ABORTED = 3;
     */
    ABORTED = 3,

    /**
     * @generated from enum value: PHASE_TIMEOUT = 4;
     */
    TIMEOUT = 4,

    /**
     * @generated from enum value: PHASE_AVAILABLE = 5;
     */
    AVAILABLE = 5,

    /**
     * @generated from enum value: PHASE_FAILED = 6;
     */
    FAILED = 6,
}
// Retrieve enum metadata with: proto3.getEnumType(PrebuildPhase_Phase)
proto3.util.setEnumType(PrebuildPhase_Phase, "gitpod.v1.PrebuildPhase.Phase", [
    { no: 0, name: "PHASE_UNSPECIFIED" },
    { no: 1, name: "PHASE_QUEUED" },
    { no: 2, name: "PHASE_BUILDING" },
    { no: 3, name: "PHASE_ABORTED" },
    { no: 4, name: "PHASE_TIMEOUT" },
    { no: 5, name: "PHASE_AVAILABLE" },
    { no: 6, name: "PHASE_FAILED" },
]);
