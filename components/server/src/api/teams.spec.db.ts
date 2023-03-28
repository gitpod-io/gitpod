/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { suite, test } from "mocha-typescript";
import { APIUserService } from "./user";
import { Container } from "inversify";
import { testContainer } from "@gitpod/gitpod-db/lib";
import { WorkspaceStarter } from "../workspace/workspace-starter";
import { UserService } from "../user/user-service";
import { BlockUserRequest, BlockUserResponse } from "@gitpod/public-api/lib/gitpod/experimental/v1/user_pb";
import { User } from "@gitpod/gitpod-protocol";
import { StopWorkspacePolicy } from "@gitpod/ws-manager/lib";
import { Workspace } from "@gitpod/gitpod-protocol/lib/protocol";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { v4 as uuidv4 } from "uuid";
import { ConnectError, Code } from "@bufbuild/connect";
import * as chai from "chai";

const expect = chai.expect;

@suite()
export class APITeamsServiceSpec {
    private container: Container;

    async before() {
        this.container = testContainer.createChild();
        this.container.bind(APIUserService).toSelf().inSingletonScope();
    }

    @test async getTeam_respondsWithTeamMembersAndInvite() {
        const sut = this.container.get<APIUserService>(APIUserService);

        const;
    }
}
