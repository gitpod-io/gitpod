/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import {
    CommitContext,
    Organization,
    Project,
    User,
    WorkspaceConfig,
    WorkspaceImageBuild,
    WorkspaceInstancePort,
} from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { OrganizationService } from "../orgs/organization-service";
import { expectError } from "../test/expect-utils";
import { createTestContainer, withTestCtx } from "../test/service-testing-container-module";
import { WorkspaceService } from "./workspace-service";
import { ProjectsService } from "../projects/projects-service";
import { ConfigProvider } from "./config-provider";
import { UserService } from "../user/user-service";
import { SYSTEM_USER } from "../authorization/authorizer";
import { v4 } from "uuid";

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
        await withTestCtx(SYSTEM_USER, () => orgService.joinOrganization(member.id, invite.id));

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
        await container.unbindAllAsync();
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
        expect(result.instanceID).to.not.be.undefined;
    });

    it("owner can start own workspace - shared", async () => {
        const workspaceService = container.get(WorkspaceService);
        const workspace = await createTestWorkspace(workspaceService, org, owner, project);
        await workspaceService.controlAdmission(owner.id, workspace.id, "everyone");

        const result = await workspaceService.startWorkspace({}, owner, workspace.id);
        expect(result.instanceID).to.not.be.undefined;
    });

    it("stanger cannot start owner workspace", async () => {
        const workspaceService = container.get(WorkspaceService);
        const workspace = await createTestWorkspace(workspaceService, org, owner, project);
        await expectError(ErrorCodes.NOT_FOUND, workspaceService.startWorkspace({}, stranger, workspace.id));
    });

    it("stanger cannot start owner workspace - shared", async () => {
        const workspaceService = container.get(WorkspaceService);
        const workspace = await createTestWorkspace(workspaceService, org, owner, project);
        await workspaceService.controlAdmission(owner.id, workspace.id, "everyone");
        await expectError(ErrorCodes.PERMISSION_DENIED, workspaceService.startWorkspace({}, stranger, workspace.id));
    });

    it("org member cannot start owner workspace", async () => {
        const workspaceService = container.get(WorkspaceService);
        const workspace = await createTestWorkspace(workspaceService, org, owner, project);
        await expectError(ErrorCodes.PERMISSION_DENIED, workspaceService.startWorkspace({}, member, workspace.id));
    });

    it("org member cannot start owner workspace - shared", async () => {
        const workspaceService = container.get(WorkspaceService);
        const workspace = await createTestWorkspace(workspaceService, org, owner, project);
        await workspaceService.controlAdmission(owner.id, workspace.id, "everyone");
        await expectError(ErrorCodes.PERMISSION_DENIED, workspaceService.startWorkspace({}, member, workspace.id));
    });

    it("org member can start own workspace", async () => {
        const workspaceService = container.get(WorkspaceService);
        const workspace = await createTestWorkspace(workspaceService, org, member, project);
        const result = await workspaceService.startWorkspace({}, member, workspace.id);
        expect(result.instanceID).to.not.be.undefined;
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

        const { workspace: ownerWs } = await svc.getWorkspace(owner.id, ws.id);
        expect(ownerWs.id).to.equal(ws.id);

        await expectError(ErrorCodes.PERMISSION_DENIED, svc.getWorkspace(member.id, ws.id));
        await expectError(ErrorCodes.NOT_FOUND, svc.getWorkspace(stranger.id, ws.id));
    });

    it("should getWorkspace - shared", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await svc.controlAdmission(owner.id, ws.id, "everyone");

        const { workspace: ownerWs } = await svc.getWorkspace(owner.id, ws.id);
        expect(ownerWs.id, "owner has access to shared workspace").to.equal(ws.id);

        const { workspace: memberWs } = await svc.getWorkspace(member.id, ws.id);
        expect(memberWs.id, "member has access to shared workspace").to.equal(ws.id);

        const { workspace: strangerWs } = await svc.getWorkspace(stranger.id, ws.id);
        expect(strangerWs.id, "stranger has access to shared workspace").to.equal(ws.id);
    });

    it("should getWorkspaces", async () => {
        const svc = container.get(WorkspaceService);
        await createTestWorkspace(svc, org, owner, project);

        const ownerResult = await svc.getWorkspaces(owner.id, {});
        expect(ownerResult).to.have.lengthOf(1);

        const memberResult = await svc.getWorkspaces(member.id, {});
        expect(memberResult).to.have.lengthOf(0);

        const strangerResult = await svc.getWorkspaces(stranger.id, {});
        expect(strangerResult).to.have.lengthOf(0);
    });

    it("should getWorkspaces - shared", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await svc.controlAdmission(owner.id, ws.id, "everyone");

        const ownerResult = await svc.getWorkspaces(owner.id, {});
        expect(ownerResult, "owner").to.have.lengthOf(1);

        // getWorkspaces is limited to the user's own workspaces atm
        const memberResult = await svc.getWorkspaces(member.id, {});
        expect(memberResult, "member").to.have.lengthOf(0);

        const strangerResult = await svc.getWorkspaces(stranger.id, {});
        expect(strangerResult, "stranger").to.have.lengthOf(0);
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
            ErrorCodes.PERMISSION_DENIED,
            svc.getOwnerToken(member.id, ws.id),
            "NOT_FOUND if member asks for the owner token",
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

    it("should getIDECredentials - shared", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await svc.controlAdmission(owner.id, ws.id, "everyone");

        const ideCredentials = await svc.getIDECredentials(owner.id, ws.id);
        expect(ideCredentials, "IDE credentials should be present").to.not.be.undefined;

        const stragnerIdeCredentials = await svc.getIDECredentials(stranger.id, ws.id);
        expect(stragnerIdeCredentials, "IDE credentials should be present").to.not.be.undefined;
    });

    it("should stopWorkspace", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await svc.stopWorkspace(owner.id, ws.id, "test");
        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.stopWorkspace(stranger.id, ws.id, "test"),
            "test stranger stopping stopped workspace",
        );
    });

    it("should stopWorkspace - shared", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await svc.controlAdmission(owner.id, ws.id, "everyone");

        await svc.stopWorkspace(owner.id, ws.id, "test");
        await expectError(
            ErrorCodes.PERMISSION_DENIED,
            svc.stopWorkspace(stranger.id, ws.id, "test"),
            "test stranger stopping stopped workspace",
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
        const { workspace: ws2 } = await svc.getWorkspace(owner.id, ws.id);
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

    it("should hardDeleteWorkspace - shared", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await svc.controlAdmission(owner.id, ws.id, "everyone");

        await expectError(
            ErrorCodes.PERMISSION_DENIED,
            svc.hardDeleteWorkspace(member.id, ws.id),
            "member can't hard-delete workspace",
        );

        await expectError(
            ErrorCodes.PERMISSION_DENIED,
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
        const { workspace: ws2 } = await svc.getWorkspace(owner.id, ws.id);
        expect(ws2.pinned, "workspace should be pinned").to.equal(true);
    });

    it("should setDescription", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);
        const desc = "Some description";

        await svc.setDescription(owner.id, ws.id, desc);
        const { workspace: ws2 } = await svc.getWorkspace(owner.id, ws.id);
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

    it("should getHeadlessLog", async () => {
        const svc = container.get(WorkspaceService);
        await createTestWorkspace(svc, org, owner, project);

        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.getHeadlessLog(owner.id, "non-existing-instanceId"),
            "should fail on non-running workspace",
        );
    });

    it("should watchWorkspaceImageBuildLogs", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);
        const client = {
            onWorkspaceImageBuildLogs: (
                info: WorkspaceImageBuild.StateInfo,
                content: WorkspaceImageBuild.LogContent | undefined,
            ) => {},
        };

        await svc.watchWorkspaceImageBuildLogs(owner.id, ws.id, client); // returns without error in case of non-running workspace

        await expectError(
            ErrorCodes.PERMISSION_DENIED,
            svc.watchWorkspaceImageBuildLogs(member.id, ws.id, client),
            "should fail for member on not-shared workspace",
        );

        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.watchWorkspaceImageBuildLogs(stranger.id, ws.id, client),
            "should fail for stranger on not-shared workspace",
        );
    });

    it("should watchWorkspaceImageBuildLogs - shared", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);
        const client = {
            onWorkspaceImageBuildLogs: (
                info: WorkspaceImageBuild.StateInfo,
                content: WorkspaceImageBuild.LogContent | undefined,
            ) => {},
        };

        await svc.controlAdmission(owner.id, ws.id, "everyone");

        await svc.watchWorkspaceImageBuildLogs(owner.id, ws.id, client); // returns without error in case of non-running workspace
        await svc.watchWorkspaceImageBuildLogs(member.id, ws.id, client);
        await svc.watchWorkspaceImageBuildLogs(stranger.id, ws.id, client);
    });

    it("should sendHeartBeat", async () => {
        const svc = container.get(WorkspaceService);
        await createTestWorkspace(svc, org, owner, project);

        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.sendHeartBeat(owner.id, {
                instanceId: "non-existing-instanceId",
            }),
            "should fail on non-running workspace",
        );
    });

    it("should controlAdmission - owner", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        // owner can share workspace
        await svc.controlAdmission(owner.id, ws.id, "everyone");
        const { workspace: wsActual } = await svc.getWorkspace(owner.id, ws.id);
        expect(wsActual.shareable, "owner should be able to share by default").to.equal(true);
    });

    it("should controlAdmission - non-owner", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        await expectError(
            ErrorCodes.PERMISSION_DENIED,
            svc.controlAdmission(member.id, ws.id, "everyone"),
            "member can't share workspace",
        );
        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.controlAdmission(stranger.id, ws.id, "everyone"),
            "stranger does not see the workspace",
        );
        await expectError(
            ErrorCodes.BAD_REQUEST,
            svc.controlAdmission(owner.id, ws.id, "asd" as "everyone"),
            "invalid admission level should fail",
        );

        const { workspace: wsActual } = await svc.getWorkspace(owner.id, ws.id);
        expect(!!wsActual.shareable, "shareable should still be false").to.equal(false);
    });

    it("should return supported workspace classes", async () => {
        const svc = container.get(WorkspaceService);

        Experiments.configureTestingClient({
            workspace_class_discovery_enabled: true,
        });

        const workspaceClasses = await svc.getSupportedWorkspaceClasses(owner);
        expect(workspaceClasses).to.not.be.undefined;
        expect(workspaceClasses.length).to.be.greaterThan(0);

        expect(workspaceClasses.filter((c) => c.id === "basic").length).to.equal(1);
        expect(workspaceClasses.filter((c) => c.id === "nextgen-basic").length).to.equal(1);
    });

    it("should controlAdmission - sharing disabled on org", async () => {
        const svc = container.get(WorkspaceService);
        const ws = await createTestWorkspace(svc, org, owner, project);

        const orgService = container.get(OrganizationService);
        await orgService.updateSettings(owner.id, org.id, { workspaceSharingDisabled: true });

        await expectError(
            ErrorCodes.PERMISSION_DENIED,
            svc.controlAdmission(owner.id, ws.id, "everyone"),
            "owner can't share workspace with setting disabled",
        );
        await expectError(
            ErrorCodes.PERMISSION_DENIED,
            svc.controlAdmission(member.id, ws.id, "everyone"),
            "member can't share workspace with setting disabled",
        );
        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.controlAdmission(stranger.id, ws.id, "everyone"),
            "stranger does not see the workspace with setting disabled",
        );
    });

    it("should listSessions", async () => {
        const svc = container.get(WorkspaceService);
        const db = container.get<WorkspaceDB>(WorkspaceDB);
        const today = new Date();
        const daysAgo = (days: number) => new Date(today.getTime() - 1000 * 60 * 60 * 24 * days);
        await createTestWorkspaceWithInstances(
            db,
            org.id,
            owner.id,
            // last Week
            { creationTime: daysAgo(7) },
            // three weeks ago
            { creationTime: daysAgo(21) },
        );

        await createTestWorkspaceWithInstances(
            db,
            org.id,
            member.id, // member
            // last Week
            { creationTime: daysAgo(18) },
            // three weeks ago
            { creationTime: daysAgo(15) },
        );

        await createTestWorkspaceWithInstances(
            db,
            v4(), // other organization
            owner.id,
            // last Week
            { creationTime: daysAgo(7) },
            // three weeks ago
            { creationTime: daysAgo(21) },
        );

        let result = await svc.listWorkspaceSessions(owner.id, org.id, daysAgo(16), daysAgo(5), 20, 0);
        expect(result.length).to.equal(2);

        result = await svc.listWorkspaceSessions(owner.id, org.id, daysAgo(5), daysAgo(0), 20, 0);
        expect(result.length).to.equal(0);

        result = await svc.listWorkspaceSessions(owner.id, org.id, daysAgo(22), daysAgo(20), 20, 0);
        expect(result.length).to.equal(1);

        result = await svc.listWorkspaceSessions(owner.id, org.id, daysAgo(40), daysAgo(0), 20, 0);
        expect(result.length).to.equal(4);

        result = await svc.listWorkspaceSessions(owner.id, org.id, daysAgo(40), daysAgo(0), 20, 1);
        expect(result.length).to.equal(3);

        result = await svc.listWorkspaceSessions(owner.id, org.id, daysAgo(40), daysAgo(0), 20, 10);
        expect(result.length).to.equal(0);

        result = await svc.listWorkspaceSessions(owner.id, org.id, daysAgo(40), daysAgo(0), 2, 0);
        expect(result.length).to.equal(2);

        await expectError(
            ErrorCodes.PERMISSION_DENIED,
            svc.listWorkspaceSessions(member.id, org.id, daysAgo(16), daysAgo(5), 20, 0),
            "members can't list workspace sessions",
        );

        await expectError(
            ErrorCodes.NOT_FOUND,
            svc.listWorkspaceSessions(stranger.id, org.id, daysAgo(16), daysAgo(5), 20, 0),
            "strangers can't list workspace sessions",
        );

        await expectError(
            ErrorCodes.BAD_REQUEST,
            svc.listWorkspaceSessions(owner.id, org.id, daysAgo(1), daysAgo(5), 20, 0),
            "from must be before to",
        );
    });

    it("should update the deletion eligibility time of a workspace", async () => {
        const svc = container.get(WorkspaceService);
        const db = container.get<WorkspaceDB>(WorkspaceDB);
        const today = new Date();
        const daysAgo = (days: number) => new Date(today.getTime() - 1000 * 60 * 60 * 24 * days);

        const ws = await createTestWorkspace(svc, org, owner, project);
        await db.storeInstance({
            id: v4(),
            workspaceId: ws.id,
            creationTime: daysAgo(7).toISOString(),
            status: {
                conditions: {},
                phase: "stopped",
            },
            region: "us-central1",
            ideUrl: "",
            configuration: {
                ideImage: "",
            },
            workspaceImage: "",
        });

        await svc.updateDeletionEligabilityTime(owner.id, ws.id);

        const workspace = await svc.getWorkspace(owner.id, ws.id);
        expect(workspace).to.not.be.undefined;
        expect(workspace.workspace.deletionEligibilityTime).to.not.be.undefined;
        expect(workspace.workspace.deletionEligibilityTime).to.eq(daysAgo(7 - 14).toISOString());
    });

    it("should update the deletion eligibility time of a workspace with git changes", async () => {
        const svc = container.get(WorkspaceService);
        const db = container.get<WorkspaceDB>(WorkspaceDB);
        const today = new Date();
        const daysAgo = (days: number) => new Date(today.getTime() - 1000 * 60 * 60 * 24 * days);

        const ws = await createTestWorkspace(svc, org, owner, project);
        await db.storeInstance({
            id: v4(),
            workspaceId: ws.id,
            creationTime: daysAgo(7).toISOString(),
            status: {
                conditions: {},
                phase: "stopped",
            },
            region: "us-central1",
            ideUrl: "",
            gitStatus: {
                totalUnpushedCommits: 2,
            },
            configuration: {
                ideImage: "",
            },
            workspaceImage: "",
        });

        await svc.updateDeletionEligabilityTime(owner.id, ws.id);

        const workspace = await svc.getWorkspace(owner.id, ws.id);
        expect(workspace).to.not.be.undefined;
        expect(workspace.workspace.deletionEligibilityTime).to.not.be.undefined;
        expect(workspace.workspace.deletionEligibilityTime).to.eq(daysAgo(7 - 14 * 2).toISOString());
    });

    it("should update the deletion eligibility time of a prebuild", async () => {
        const svc = container.get(WorkspaceService);
        const db = container.get<WorkspaceDB>(WorkspaceDB);
        const today = new Date();
        const daysAgo = (days: number) => new Date(today.getTime() - 1000 * 60 * 60 * 24 * days);

        const ws = await createTestWorkspace(svc, org, owner, project);
        ws.type = "prebuild";
        await db.store(ws);
        await db.storeInstance({
            id: v4(),
            workspaceId: ws.id,
            creationTime: daysAgo(7).toISOString(),
            status: {
                conditions: {},
                phase: "stopped",
            },
            region: "us-central1",
            ideUrl: "",
            gitStatus: {
                totalUnpushedCommits: 2,
            },
            configuration: {
                ideImage: "",
            },
            workspaceImage: "",
        });

        await svc.updateDeletionEligabilityTime(owner.id, ws.id);

        const workspace = await svc.getWorkspace(owner.id, ws.id);
        expect(workspace).to.not.be.undefined;
        expect(workspace.workspace.deletionEligibilityTime).to.not.be.undefined;
        expect(workspace.workspace.deletionEligibilityTime).to.eq(daysAgo(7 - 7).toISOString());
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
        undefined,
    );
    return ws;
}

async function createTestWorkspaceWithInstances(
    db: WorkspaceDB,
    organizationId: string,
    ownerId: string,
    ...instances: {
        creationTime: Date;
    }[]
) {
    const id = v4();
    await db.store({
        id,
        creationTime: new Date().toISOString(),
        organizationId,
        ownerId,
        contextURL: "myContext",
        type: "regular",
        description: "myDescription",
        context: {
            title: "myTitle",
        },
        config: {},
    });

    for (const instance of instances) {
        await db.storeInstance({
            id: v4(),
            workspaceId: id,
            creationTime: instance.creationTime.toISOString(),
            status: {
                conditions: {},
                phase: "stopped",
            },
            region: "us-central1",
            ideUrl: "",
            configuration: {
                ideImage: "",
            },
            workspaceImage: "",
        });
    }

    return id;
}
