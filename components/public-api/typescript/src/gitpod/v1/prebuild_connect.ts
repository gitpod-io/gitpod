/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-connect-es v1.1.2 with parameter "target=ts"
// @generated from file gitpod/v1/prebuild.proto (package gitpod.v1, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import { CancelPrebuildRequest, CancelPrebuildResponse, GetPrebuildLogUrlRequest, GetPrebuildLogUrlResponse, GetPrebuildRequest, GetPrebuildResponse, ListOrganizationPrebuildsRequest, ListOrganizationPrebuildsResponse, ListPrebuildsRequest, ListPrebuildsResponse, StartPrebuildRequest, StartPrebuildResponse, WatchPrebuildRequest, WatchPrebuildResponse } from "./prebuild_pb.js";
import { MethodKind } from "@bufbuild/protobuf";

/**
 * @generated from service gitpod.v1.PrebuildService
 */
export const PrebuildService = {
  typeName: "gitpod.v1.PrebuildService",
  methods: {
    /**
     * @generated from rpc gitpod.v1.PrebuildService.StartPrebuild
     */
    startPrebuild: {
      name: "StartPrebuild",
      I: StartPrebuildRequest,
      O: StartPrebuildResponse,
      kind: MethodKind.Unary,
    },
    /**
     * @generated from rpc gitpod.v1.PrebuildService.CancelPrebuild
     */
    cancelPrebuild: {
      name: "CancelPrebuild",
      I: CancelPrebuildRequest,
      O: CancelPrebuildResponse,
      kind: MethodKind.Unary,
    },
    /**
     * @generated from rpc gitpod.v1.PrebuildService.GetPrebuild
     */
    getPrebuild: {
      name: "GetPrebuild",
      I: GetPrebuildRequest,
      O: GetPrebuildResponse,
      kind: MethodKind.Unary,
    },
    /**
     * @generated from rpc gitpod.v1.PrebuildService.ListPrebuilds
     */
    listPrebuilds: {
      name: "ListPrebuilds",
      I: ListPrebuildsRequest,
      O: ListPrebuildsResponse,
      kind: MethodKind.Unary,
    },
    /**
     * @generated from rpc gitpod.v1.PrebuildService.WatchPrebuild
     */
    watchPrebuild: {
      name: "WatchPrebuild",
      I: WatchPrebuildRequest,
      O: WatchPrebuildResponse,
      kind: MethodKind.ServerStreaming,
    },
    /**
     * @generated from rpc gitpod.v1.PrebuildService.GetPrebuildLogUrl
     */
    getPrebuildLogUrl: {
      name: "GetPrebuildLogUrl",
      I: GetPrebuildLogUrlRequest,
      O: GetPrebuildLogUrlResponse,
      kind: MethodKind.Unary,
    },
    /**
     * ListOrganizationPrebuilds lists all prebuilds of an organization
     *
     * @generated from rpc gitpod.v1.PrebuildService.ListOrganizationPrebuilds
     */
    listOrganizationPrebuilds: {
      name: "ListOrganizationPrebuilds",
      I: ListOrganizationPrebuildsRequest,
      O: ListOrganizationPrebuildsResponse,
      kind: MethodKind.Unary,
    },
  }
} as const;
