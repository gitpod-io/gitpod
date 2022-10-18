/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-connect-web v0.2.1 with parameter "target=ts"
// @generated from file gitpod/v1/teams.proto (package gitpod.v1, syntax proto3)
/* eslint-disable */
/* @ts-nocheck */

import {CreateTeamRequest, CreateTeamResponse} from "./teams_pb.js";
import {MethodKind} from "@bufbuild/protobuf";

/**
 * @generated from service gitpod.v1.TeamsService
 */
export const TeamsService = {
  typeName: "gitpod.v1.TeamsService",
  methods: {
    /**
     * CreateTeam creates a new Team and assigns the caller as the Owner of the Team.
     *
     * @generated from rpc gitpod.v1.TeamsService.CreateTeam
     */
    createTeam: {
      name: "CreateTeam",
      I: CreateTeamRequest,
      O: CreateTeamResponse,
      kind: MethodKind.Unary,
    },
  }
} as const;
