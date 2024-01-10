/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-connect-es v1.1.2 with parameter "target=ts"
// @generated from file gitpod/experimental/v1/ide_client.proto (package gitpod.experimental.v1, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import { SendDidCloseRequest, SendDidCloseResponse, SendHeartbeatRequest, SendHeartbeatResponse, UpdateGitStatusRequest, UpdateGitStatusResponse } from "./ide_client_pb.js";
import { MethodKind } from "@bufbuild/protobuf";

/**
 * @generated from service gitpod.experimental.v1.IDEClientService
 */
export const IDEClientService = {
  typeName: "gitpod.experimental.v1.IDEClientService",
  methods: {
    /**
     * SendHeartbeat sends a clientheartbeat signal for a running workspace.
     *
     * @generated from rpc gitpod.experimental.v1.IDEClientService.SendHeartbeat
     */
    sendHeartbeat: {
      name: "SendHeartbeat",
      I: SendHeartbeatRequest,
      O: SendHeartbeatResponse,
      kind: MethodKind.Unary,
    },
    /**
     * SendDidClose sends a client close signal for a running workspace.
     *
     * @generated from rpc gitpod.experimental.v1.IDEClientService.SendDidClose
     */
    sendDidClose: {
      name: "SendDidClose",
      I: SendDidCloseRequest,
      O: SendDidCloseResponse,
      kind: MethodKind.Unary,
    },
    /**
     * UpdateGitStatus updates the status of a repository in a workspace.
     *
     * @generated from rpc gitpod.experimental.v1.IDEClientService.UpdateGitStatus
     */
    updateGitStatus: {
      name: "UpdateGitStatus",
      I: UpdateGitStatusRequest,
      O: UpdateGitStatusResponse,
      kind: MethodKind.Unary,
    },
  }
} as const;
