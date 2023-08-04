/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import { APIUserService } from "./user";
import { Container } from "inversify";
import { testContainer } from "@gitpod/gitpod-db/lib";
import { UserAuthentication } from "../user/user-authentication";
import { BlockUserRequest, BlockUserResponse } from "@gitpod/public-api/lib/gitpod/experimental/v1/user_pb";
import { User } from "@gitpod/gitpod-protocol";
import { StopWorkspacePolicy } from "@gitpod/ws-manager/lib";
import { Workspace } from "@gitpod/gitpod-protocol/lib/protocol";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { v4 as uuidv4 } from "uuid";
import { ConnectError, Code } from "@bufbuild/connect";
import * as chai from "chai";
import { WorkspaceService } from "../workspace/workspace-service";

const expect = chai.expect;

@suite()
export class APIUserServiceSpec {
    private container: Container;
    private workspaceStarterMock: WorkspaceService = {
        stopRunningWorkspacesForUser: async (
            ctx: TraceContext,
            userId: string,
            userIdToStop: string,
            reason: string,
            policy?: StopWorkspacePolicy,
        ): Promise<Workspace[]> => {
            return [];
        },
    } as WorkspaceService;
    private userServiceMock: UserAuthentication = {
        blockUser: async (targetUserId: string, block: boolean): Promise<User> => {
            return {
                id: targetUserId,
            } as User;
        },
    } as UserAuthentication;

    async before() {
        this.container = testContainer.createChild();

        this.container.bind(WorkspaceService).toConstantValue(this.workspaceStarterMock);
        this.container.bind(UserAuthentication).toConstantValue(this.userServiceMock);
        this.container.bind(APIUserService).toSelf().inSingletonScope();
    }

    @test async blockUser_rejectsInvalidArguments() {
        const scenarios: BlockUserRequest[] = [
            new BlockUserRequest({ userId: "", reason: "naughty" }), // no user id
            new BlockUserRequest({ userId: "foo", reason: "naughty" }), // user id is not a uuid
            new BlockUserRequest({ userId: uuidv4(), reason: "" }), // no reason value
        ];

        const sut = this.container.get<APIUserService>(APIUserService);

        for (const scenario of scenarios) {
            try {
                await sut.blockUser(scenario);
                expect.fail("blockUser did not throw an exception");
            } catch (err) {
                expect(err).to.be.an.instanceof(ConnectError);
                expect(err.code).to.equal(Code.InvalidArgument);
            }
        }
    }

    @test async blockUser_delegatesToUserServiceAndWorkspaceStarter() {
        const sut = this.container.get<APIUserService>(APIUserService);

        const response = await sut.blockUser(new BlockUserRequest({ userId: uuidv4(), reason: "naughty" }));
        expect(response).to.deep.equal(new BlockUserResponse());
    }
}
