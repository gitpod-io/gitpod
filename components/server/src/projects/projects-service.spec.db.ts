/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM, UserDB } from "@gitpod/gitpod-db/lib";
import { Organization, User } from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { OrganizationService } from "../orgs/organization-service";
import { createTestContainer } from "../test/service-testing-container-module";
import { ProjectsService } from "./projects-service";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { SpiceDBAuthorizer } from "../authorization/spicedb-authorizer";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { expectError } from "../test/expect-utils";

const expect = chai.expect;

describe("ProjectsService", async () => {
    let container: Container;
    let owner: User;
    let member: User;
    let stranger: User;
    let org: Organization;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({
            centralizedPermissions: true,
        });
        const userDB = container.get<UserDB>(UserDB);

        // create the owner
        owner = await userDB.newUser();

        // create the org
        const orgService = container.get(OrganizationService);
        org = await orgService.createOrganization(owner.id, "my-org");

        const a = container.get(SpiceDBAuthorizer);
        await a.logRelationships();
        // create and add a member
        member = await userDB.newUser();
        const invite = await orgService.getOrCreateInvite(owner.id, org.id);
        await orgService.joinOrganization(member.id, invite.id);

        // create a stranger
        stranger = await userDB.newUser();
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
    });

    it("should getProject and getProjects", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        let foundProject = await ps.getProject(owner.id, project.id);
        expect(foundProject?.id).to.equal(project.id);

        let projects = await ps.getProjects(owner.id, org.id);
        expect(projects.length).to.equal(1);

        foundProject = await ps.getProject(member.id, project.id);
        expect(foundProject?.id).to.equal(project.id);

        projects = await ps.getProjects(member.id, org.id);
        expect(projects.length).to.equal(1);

        await expectError(ErrorCodes.NOT_FOUND, () => ps.getProject(stranger.id, project.id));
        await expectError(ErrorCodes.NOT_FOUND, () => ps.getProjects(stranger.id, org.id));
    });

    it("should deleteProject", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        await expectError(ErrorCodes.PERMISSION_DENIED, () => ps.deleteProject(member.id, project.id));
        await expectError(ErrorCodes.NOT_FOUND, () => ps.deleteProject(stranger.id, project.id));

        await ps.deleteProject(owner.id, project.id);
        const projects = await ps.getProjects(owner.id, org.id);
        expect(projects.length).to.equal(0);
    });

    it("should updateProject", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);
        await ps.updateProject(owner.id, {
            id: project.id,
            settings: {
                useIncrementalPrebuilds: !project.settings?.useIncrementalPrebuilds,
            },
        });

        const updatedProject = await ps.getProject(owner.id, project.id);

        expect(updatedProject?.settings?.useIncrementalPrebuilds).to.not.equal(
            project.settings?.useIncrementalPrebuilds,
        );

        await expectError(ErrorCodes.PERMISSION_DENIED, () =>
            ps.updateProject(member.id, {
                id: project.id,
                settings: {
                    useIncrementalPrebuilds: !project.settings?.useIncrementalPrebuilds,
                },
            }),
        );
        await expectError(ErrorCodes.NOT_FOUND, () =>
            ps.updateProject(stranger.id, {
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

        await expectError(ErrorCodes.NOT_FOUND, () => ps.getProjectEnvironmentVariableById(owner.id, envVars[0].id));

        const emptyEnvVars = await ps.getProjectEnvironmentVariables(owner.id, project.id);
        expect(emptyEnvVars.length).to.equal(0);
    });

    it("should not let members create, delete but allow get project env vars", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);
        await ps.setProjectEnvironmentVariable(owner.id, project.id, "FOO", "BAR", false);

        const envVars = await ps.getProjectEnvironmentVariables(member.id, project.id);
        expect(envVars[0].name).to.equal("FOO");

        const envVarById = await ps.getProjectEnvironmentVariableById(member.id, envVars[0].id);
        expect(envVarById?.name).to.equal("FOO");

        await expectError(ErrorCodes.PERMISSION_DENIED, () =>
            ps.deleteProjectEnvironmentVariable(member.id, envVars[0].id),
        );

        await expectError(ErrorCodes.PERMISSION_DENIED, () =>
            ps.setProjectEnvironmentVariable(member.id, project.id, "FOO", "BAR", false),
        );
    });

    it("should not let strangers create, delete and get project env vars", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        await ps.setProjectEnvironmentVariable(owner.id, project.id, "FOO", "BAR", false);

        const envVars = await ps.getProjectEnvironmentVariables(owner.id, project.id);
        expect(envVars[0].name).to.equal("FOO");

        // let's try to get the env var as a stranger
        await expectError(ErrorCodes.NOT_FOUND, () => ps.getProjectEnvironmentVariableById(stranger.id, envVars[0].id));

        // let's try to delete the env var as a stranger
        await expectError(ErrorCodes.NOT_FOUND, () => ps.deleteProjectEnvironmentVariable(stranger.id, envVars[0].id));

        // let's try to get the env vars as a stranger
        await expectError(ErrorCodes.NOT_FOUND, () => ps.getProjectEnvironmentVariables(stranger.id, project.id));
    });

    it("should findProjects", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);
        await createTestProject(ps, org, owner, "my-project-2", "https://github.com/foo/bar.git");
        await createTestProject(ps, org, member, "my-project-3", "https://github.com/foo/baz.git");

        const foundProjects = await ps.findProjects(owner.id, {
            orderBy: "name",
        });
        expect(foundProjects.total).to.equal(3);
        expect(foundProjects.rows[0].name).to.equal(project.name);
        expect(foundProjects.rows[1].name).to.equal("my-project-2");
        expect(foundProjects.rows[2].name).to.equal("my-project-3");

        const projects = await ps.getProjects(member.id, org.id);
        expect(projects.length).to.equal(3);

        await expectError(ErrorCodes.NOT_FOUND, () => ps.getProject(stranger.id, project.id));
        await expectError(ErrorCodes.NOT_FOUND, () => ps.getProjects(stranger.id, org.id));
    });
});

async function createTestProject(
    ps: ProjectsService,
    org: Organization,
    owner: User,
    name = "my-project",
    cloneUrl = "https://github.com/gitpod-io/gitpod.git",
) {
    const project = await ps.createProject(
        {
            name,
            slug: name,
            teamId: org.id,
            cloneUrl,
            appInstallationId: "noid",
        },
        owner,
    );
    return project;
}
