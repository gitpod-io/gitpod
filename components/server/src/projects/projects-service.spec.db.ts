/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBUser, TypeORM, UserDB, testContainer } from "@gitpod/gitpod-db/lib";
import { DBProject } from "@gitpod/gitpod-db/lib/typeorm/entity/db-project";
import { DBTeam } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team";
import { Organization, User } from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { OrganizationService } from "../orgs/organization-service";
import { serviceTestingContainerModule } from "../test/service-testing-container-module";
import { ProjectsService } from "./projects-service";
import { ApplicationError, ErrorCode, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

const expect = chai.expect;

describe("ProjectsService", async () => {
    let container: Container;
    let owner: User;
    let member: User;
    let stranger: User;
    let org: Organization;

    beforeEach(async () => {
        container = testContainer.createChild();
        container.load(serviceTestingContainerModule);
        Experiments.configureTestingClient({
            centralizedPermissions: true,
        });
        const userDB = container.get<UserDB>(UserDB);
        owner = await userDB.newUser();
        member = await userDB.newUser();
        stranger = await userDB.newUser();
        const orgService = container.get(OrganizationService);
        org = await orgService.createOrganization(owner.id, "my-org");
        const invite = await orgService.getOrCreateInvite(owner.id, org.id);
        await orgService.joinOrganization(member.id, invite.id);
    });

    afterEach(async () => {
        // Clean-up database
        const typeorm = testContainer.get(TypeORM);
        const dbConn = await typeorm.getConnection();
        await dbConn.getRepository(DBTeam).delete({});
        await dbConn.getRepository(DBProject).delete({});
        const repo = (await typeorm.getConnection()).getRepository(DBUser);
        await repo.delete(owner.id);
        await repo.delete(stranger.id);
    });

    it("should let owners find their projects", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        const foundProject = await ps.getProject(owner.id, project.id);
        expect(foundProject?.id).to.equal(project.id);
        const projects = await ps.getProjects(owner.id, org.id);
        expect(projects.length).to.equal(1);
    });

    it("should not let strangers find projects", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        await expectError(ErrorCodes.NOT_FOUND, () => ps.getProject(stranger.id, project.id));
        await expectError(ErrorCodes.NOT_FOUND, () => ps.getProjects(stranger.id, org.id));
    });

    it("should not let strangers delete projects", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        await expectError(ErrorCodes.NOT_FOUND, () => ps.deleteProject(stranger.id, project.id));
    });

    it("should let owners delete their projects", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);
        await ps.deleteProject(owner.id, project.id);

        await expectError(ErrorCodes.NOT_FOUND, () => ps.getProject(owner.id, project.id));

        const projects = await ps.getProjects(owner.id, org.id);
        expect(projects.length).to.equal(0);
    });

    it("should let owners update their project settings", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);
        await ps.updateProjectPartial(owner.id, {
            id: project.id,
            settings: {
                useIncrementalPrebuilds: !project.settings?.useIncrementalPrebuilds,
            },
        });

        const updatedProject = await ps.getProject(owner.id, project.id);

        expect(updatedProject?.settings?.useIncrementalPrebuilds).to.not.equal(
            project.settings?.useIncrementalPrebuilds,
        );
    });

    it("should not let members update project settings", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        await expectError(ErrorCodes.PERMISSION_DENIED, () =>
            ps.updateProjectPartial(member.id, {
                id: project.id,
                settings: {
                    useIncrementalPrebuilds: !project.settings?.useIncrementalPrebuilds,
                },
            }),
        );
    });

    it("should not let strangers update project settings", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        await expectError(ErrorCodes.NOT_FOUND, () =>
            ps.updateProjectPartial(stranger.id, {
                id: project.id,
                settings: {
                    useIncrementalPrebuilds: !project.settings?.useIncrementalPrebuilds,
                },
            }),
        );
    });

    it("should let owners create, delete and get project env vars", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);
        await ps.setProjectEnvironmentVariable(owner.id, project.id, "FOO", "BAR", false);

        const envVars = await ps.getProjectEnvironmentVariables(owner.id, project.id);
        expect(envVars[0].name).to.equal("FOO");

        const envVarById = await ps.getProjectEnvironmentVariableById(owner.id, envVars[0].id);
        expect(envVarById?.name).to.equal("FOO");

        await ps.deleteProjectEnvironmentVariable(owner.id, envVars[0].id);

        const deletedEnvVar = await ps.getProjectEnvironmentVariableById(owner.id, envVars[0].id);
        expect(deletedEnvVar).to.be.undefined;

        const emptyEnvVars = await ps.getProjectEnvironmentVariables(owner.id, project.id);
        expect(emptyEnvVars.length).to.equal(0);
    });

    it("should not let strangers create, delete and get project env vars", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        await ps.setProjectEnvironmentVariable(owner.id, project.id, "FOO", "BAR", false);

        const envVars = await ps.getProjectEnvironmentVariables(owner.id, project.id);
        expect(envVars[0].name).to.equal("FOO");

        // let's try to get the env var as a stranger
        const variable = await ps.getProjectEnvironmentVariableById(stranger.id, envVars[0].id);
        expect(variable).to.be.undefined;

        // let's try to delete the env var as a stranger
        try {
            await ps.deleteProjectEnvironmentVariable(stranger.id, envVars[0].id);
            expect.fail("should not be able to delete env var as stranger");
        } catch (error) {
            expectErrorCode(error, ErrorCodes.NOT_FOUND);
        }

        // let's try to get the env vars as a stranger
        try {
            await ps.getProjectEnvironmentVariables(stranger.id, project.id);
            expect.fail("should not be able to get env vars as stranger");
        } catch (error) {
            expectErrorCode(error, ErrorCodes.NOT_FOUND);
        }
    });
});

async function expectError(errorCode: ErrorCode, code: () => Promise<any>) {
    try {
        await code();
        expect.fail("expected error: " + errorCode);
    } catch (error) {
        expectErrorCode(error, errorCode);
    }
}

function expectErrorCode(err: any, errorCode: ErrorCode) {
    expect(err && ApplicationError.hasErrorCode(err) && err.code).to.equal(errorCode);
}

async function createTestProject(ps: ProjectsService, org: Organization, owner: User) {
    return await ps.createProject(
        {
            name: "my-project",
            slug: "my-project",
            teamId: org.id,
            cloneUrl: "https://github.com/gipod-io/gitpod.git",
            appInstallationId: "noid",
        },
        owner,
    );
}
