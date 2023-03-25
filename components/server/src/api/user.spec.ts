import { suite, test } from "mocha-typescript";
import { APIUserService } from "./user";
import { Container } from "inversify";
import { testContainer } from "@gitpod/gitpod-db/lib";
import { WorkspaceStarter } from "../workspace/workspace-starter";
import { UserService } from "../user/user-service";
import { BlockUserRequest } from "@gitpod/public-api/lib/gitpod/experimental/v1/user_pb";
import { User } from "@gitpod/gitpod-protocol";
import { StopWorkspacePolicy } from "@gitpod/ws-manager/lib";
import { Workspace } from "@gitpod/gitpod-protocol/src/protocol";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";

@suite()
export class APIUserServiceSpec {
    private container: Container;
    private workspaceStarter: WorkspaceStarter;
    private userService: UserService;

    private sut: APIUserService;

    async before() {
        this.workspaceStarter = {} as WorkspaceStarter;
        this.userService = {} as UserService;
        this.container = testContainer.createChild();

        this.container.bind(WorkspaceStarter).toDynamicValue((ctx) => this.workspaceStarter);
        this.container.bind(UserService).toDynamicValue((ctx) => this.userService);
        this.container.bind(APIUserService).toSelf().inSingletonScope();
    }

    @test async blockUser_rejectsInvalidArguments() {
        this.userService.blockUser = async (targetUserId: string, block: boolean): Promise<User> => {
            return {
                id: targetUserId,
            } as User;
        };
        this.workspaceStarter.stopRunningWorkspacesForUser = async (
            ctx: TraceContext,
            userID: string,
            reason: string,
            policy?: StopWorkspacePolicy,
        ): Promise<Workspace[]> => {
            return [];
        };

        await this.sut.blockUser(new BlockUserRequest({ userId: "foo", reason: "naughty" }));
    }
}
