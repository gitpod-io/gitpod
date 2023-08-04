/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM, UserDB } from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { CommitContext, Organization, Project, User, WorkspaceConfig } from "@gitpod/gitpod-protocol";
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
        const userDB = container.get<UserDB>(UserDB);

        // create the owner
        owner = await userDB.newUser();

        // create the org
        const orgService = container.get(OrganizationService);
        org = await orgService.createOrganization(owner.id, "my-org");

        // create and add a member
        member = await userDB.newUser();
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
        stranger = await userDB.newUser();
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
    });

    it("should createWorkspace", async () => {
        const svc = container.get(WorkspaceService);

        // Owner can create a workspace in our org
        await createTestWorkspace(svc, org, owner, project);

        // Stranger can't create a workspace in our org
        await expectError(ErrorCodes.NOT_FOUND, createTestWorkspace(svc, org, stranger, project));
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
