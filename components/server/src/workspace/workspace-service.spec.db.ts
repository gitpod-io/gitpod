/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM } from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import {
    CommitContext,
    Organization,
    Project,
    User,
    WorkspaceConfig,
    WorkspaceInstancePort,
} from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { OrganizationService } from "../orgs/organization-service";
import { expectError } from "../test/expect-utils";
import { createTestContainer } from "../test/service-testing-container-module";
import { WorkspaceService } from "./workspace-service";
import { ProjectsService } from "../projects/projects-service";
import { ConfigProvider } from "./config-provider";
import { UserService } from "../user/user-service";

const expect = chai.expect;

describe("WorkspaceService", async () => {
    let container: Container;
    let owner: User;
    let member: User;
    let stranger: User;
    let org: Organization;
    let project: Project;

    beforeEach(async () => {
        container = createTestContainer();
        // TODO(gpl) Ideally we should be able to factor this out into the API. But to start somewhere, we'll mock it out here.
        container.rebind(ConfigProvider).toConstantValue({
            fetchConfig: () => ({
                config: <WorkspaceConfig>{
                    image: "gitpod/workspace-full:latest",
                },
            }),
        } as any as ConfigProvider);
        Experiments.configureTestingClient({
            centralizedPermissions: true,
        });
        const userService = container.get(UserService);

        // create the owner
        owner = await userService.createUser({
            identity: {
                authId: "33891423",
                authName: "owner",
                authProviderId: "Public-GitHub",
            },
        });

        // create the org
        const orgService = container.get(OrganizationService);
        org = await orgService.createOrganization(owner.id, "my-org");

        // create and add a member
        member = await userService.createUser({
            identity: {
                authId: "33891424",
                authName: "member",
                authProviderId: "Public-GitHub",
            },
        });
        const invite = await orgService.getOrCreateInvite(owner.id, org.id);
        await orgService.joinOrganization(member.id, invite.id);

        // create a project
        const projectService = container.get(ProjectsService);
        project = await projectService.createProject(
            {
                name: "my-project",
                slug: "my-project",
                teamId: org.id,
                cloneUrl: "https://github.com/gitpod-io/gitpod",
                appInstallationId: "noid",
            },
            owner,
        );

        // create a stranger
        stranger = await userService.createUser({
            identity: {
                authId: "33891425",
                authName: "stranger",
                authProviderId: "Public-GitHub",
            },
        });
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
        // Deactivate all services
        container.unbindAll();
    });

    it("should createWorkspace", async () => {
        const svc = container.get(WorkspaceService);

        // Owner can create a workspace in our org
        await createTestWorkspace(svc, org, owner, project);

        // Stranger can't create a workspace in our org
        await expectError(ErrorCodes.NOT_FOUND, createTestWorkspace(svc, org, stranger, project));
    });

    it("owner can start own workspace", async () => {
        const workspaceService = container.get(WorkspaceService);
        const workspace = await createTestWorkspace(workspaceService, org, owner, project);
        const result = await workspaceService.startWorkspace({}, owner, workspace.id);
        expect(result.workspaceURL).to.equal(`https://${workspace.id}.ws.gitpod.io`);
    });

    it("stanger cannot start owner workspace", async () => {
        const workspaceService = container.get(WorkspaceService);
        const workspace = await createTestWorkspace(workspaceService, org, owner, project);
        await expectError(ErrorCodes.NOT_FOUND, workspaceService.startWorkspace({}, stranger, workspace.id));
    });

    it("org member cannot start owner workspace", async () => {
        const workspaceService = container.get(WorkspaceService);
        const workspace = await createTestWorkspace(workspaceService, org, owner, project);
        await expectError(ErrorCodes.PERMISSION_DENIED, workspaceService.startWorkspace({}, member, workspace.id));
    });

    it("org member can start own workspace", async () => {
        const workspaceService = container.get(WorkspaceService);
        const workspace = await createTestWorkspace(workspaceService, org, member, project);
        const result = await workspaceService.startWorkspace({}, member, workspace.id);
        expect(result.workspaceURL).to.equal(`https://${workspace.id}.ws.gitpod.io`);
    });

    it("stanger cannot start org member workspace", async () => {
        const workspaceService = container.get(WorkspaceService);
        const workspace = await createTestWorkspace(workspaceService, org, member, project);
        await expectError(ErrorCodes.NOT_FOUND, workspaceService.startWorkspace({}, stranger, workspace.id));
    });

    it("owner cannot start org member workspace", async () => {
        const workspaceService = container.get(WorkspaceService);
        const workspace = await createTestWorkspace(workspaceService, org, member, project);
        await expectError(ErrorCodes.PERMISSION_DENIED, workspaceService.startWorkspace({}, owner, workspace.id));
    });

    it("should getWorkspace", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        const foundWorkspace = await svc.getWorkspace(owner.id, ws.id);
        expect(foundWorkspace?.id).to.equal(ws.id);

        await expectError(ErrorCodes.NOT_FOUND, svc.getWorkspace(stranger.id, ws.id));
    });

    it("should getOwnerToken", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.getOwnerToken(owner.id, ws.id),
            "NOT_FOUND for non-running workspace",
        );

        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.getOwnerToken(stranger.id, ws.id),
            "NOT_FOUND if stranger asks for the owner token",
        );
    });

    it("should getIDECredentials", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        const ideCredentials = await svc.getIDECredentials(owner.id, ws.id);
        expect(ideCredentials, "IDE credentials should be present").to.not.be.undefined;

        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.getIDECredentials(stranger.id, ws.id),
            "NOT_FOUND if stranger asks for the IDE credentials",
        );
    });

    it("should stopWorkspace", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await svc.stopWorkspace(owner.id, ws.id, "test stopping stopped workspace");
        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.stopWorkspace(stranger.id, ws.id, "test stranger stopping stopped workspace"),
        );
    });

    it("should deleteWorkspace", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.deleteWorkspace(stranger.id, ws.id),
            "stranger can't delete workspace",
        );

        await svc.deleteWorkspace(owner.id, ws.id);
        // TODO(gpl) For now, we keep the old behavior which will return a workspace, even if it's marked as "softDeleted"
        // await expectError(
        //     ErrorCodes.NOT_FOUND,
        //     svc.getWorkspace(owner.id, ws.id),
        //     "getWorkspace should return NOT_FOUND after deletion",
        // );
        const ws2 = await svc.getWorkspace(owner.id, ws.id);
        expect(ws2.softDeleted, "workspace should be marked as 'softDeleted'").to.equal("user");
    });

    it("should hardDeleteWorkspace", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.hardDeleteWorkspace(stranger.id, ws.id),
            "stranger can't hard-delete workspace",
        );

        await svc.hardDeleteWorkspace(owner.id, ws.id);
        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.getWorkspace(owner.id, ws.id),
            "getWorkspace should return NOT_FOUND after hard-deletion",
        );
    });

    it("should setPinned", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await expectError(ErrorCodes.NOT_FOUND, svc.setPinned(stranger.id, ws.id, true));
        await svc.setPinned(owner.id, ws.id, true);
        const ws2 = await svc.getWorkspace(owner.id, ws.id);
        expect(ws2.pinned, "workspace should be pinned").to.equal(true);
    });

    it("should setDescription", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);
        const desc = "Some description";

        await svc.setDescription(owner.id, ws.id, desc);
        const ws2 = await svc.getWorkspace(owner.id, ws.id);
        expect(ws2.description).to.equal(desc);

        await expectError(ErrorCodes.NOT_FOUND, svc.setDescription(stranger.id, ws.id, desc));
    });

    it("should getOpenPorts", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.getOpenPorts(owner.id, ws.id),
            "should fail on non-running workspace",
        );
    });

    it("should openPort", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        const port: WorkspaceInstancePort = {
            port: 8080,
        };
        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.openPort(owner.id, ws.id, port),
            "should fail on non-running workspace",
        );
    });

    it("should closePort", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.closePort(owner.id, ws.id, 8080),
            "should fail on non-running workspace",
        );
    });

    it("should updateGitStatus", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.updateGitStatus(owner.id, ws.id, {
                branch: "main",
                uncommitedFiles: ["new-unit.ts"],
                latestCommit: "asdf",
                totalUncommitedFiles: 1,
                totalUntrackedFiles: 1,
                unpushedCommits: [],
                untrackedFiles: ["new-unit.ts"],
                totalUnpushedCommits: 0,
            }),
            "should fail on non-running workspace",
        );
    });

    it("should getWorkspaceTimeout", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        const actual = await svc.getWorkspaceTimeout(owner.id, ws.id);
        expect(actual, "even stopped workspace get a default response").to.not.be.undefined;
    });

    it("should setWorkspaceTimeout", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.setWorkspaceTimeout(owner.id, ws.id, "180m"),
            "should fail on non-running workspace",
        );
    });
});

async function createTestWorkspace(svc: WorkspaceService, org: Organization, owner: User, project: Project) {
    const ws = await svc.createWorkspace(
        {},
        owner,
        org.id,
        project,
        <CommitContext>{
            title: "gitpod",
            repository: {
                host: "github.com",
                owner: "gitpod-io",
                name: "gitpod",
                cloneUrl: "https://github.com/gitpod-io/gitpod.git",
            },
            revision: "asdf",
        },
        "github.com/gitpod-io/gitpod",
    );
    return ws;
}
