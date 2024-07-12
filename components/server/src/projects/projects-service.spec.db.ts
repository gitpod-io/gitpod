/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ProjectDB, TypeORM, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { Organization, Project, ProjectSettings, User } from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { OrganizationService } from "../orgs/organization-service";
import { expectError } from "../test/expect-utils";
import { createTestContainer, withTestCtx } from "../test/service-testing-container-module";
import { OldProjectSettings, ProjectsService } from "./projects-service";
import { daysBefore } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { SYSTEM_USER } from "../authorization/authorizer";
import { EnvVarService } from "../user/env-var-service";

const expect = chai.expect;

describe("ProjectsService", async () => {
    let container: Container;
    let owner: User;
    let member: User;
    let stranger: User;
    let org: Organization;
    let anotherOrg: Organization;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({});
        const userDB = container.get<UserDB>(UserDB);

        // create the owner
        owner = await userDB.newUser();

        // create the org
        const orgService = container.get(OrganizationService);
        org = await orgService.createOrganization(owner.id, "my-org");
        anotherOrg = await orgService.createOrganization(owner.id, "another-org");

        // create and add a member
        member = await userDB.newUser();
        const invite = await orgService.getOrCreateInvite(owner.id, org.id);
        await withTestCtx(SYSTEM_USER, () => orgService.joinOrganization(member.id, invite.id));

        const anotherInvite = await orgService.getOrCreateInvite(owner.id, anotherOrg.id);
        await withTestCtx(SYSTEM_USER, () => orgService.joinOrganization(member.id, anotherInvite.id));

        // create a stranger
        stranger = await userDB.newUser();
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
        // Deactivate all services
        await container.unbindAllAsync();
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

    it("should setVisibility", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        await expectError(ErrorCodes.NOT_FOUND, () => ps.getProject(stranger.id, project.id));
        await expectError(ErrorCodes.NOT_FOUND, () => ps.getProjects(stranger.id, org.id));
        await ps.setVisibility(owner.id, project.id, "public");

        const foundProject = await ps.getProject(stranger.id, project.id);
        expect(foundProject?.id).to.equal(project.id);
        // listing by org still doesn't woprk because strangers don't have access to the org
        await expectError(ErrorCodes.NOT_FOUND, () => ps.getProjects(stranger.id, org.id));
    });

    it("should deleteProject", async () => {
        const ps = container.get(ProjectsService);
        const evs = container.get(EnvVarService);
        const pdb = container.get<ProjectDB>(ProjectDB);
        const project1 = await createTestProject(ps, org, owner);
        await evs.addProjectEnvVar(member.id, project1.id, {
            name: "key",
            value: "value",
            censored: false,
        });

        expect(await pdb.getProjectEnvironmentVariables(project1.id)).to.have.lengthOf(1);

        await ps.deleteProject(member.id, project1.id);
        let projects = await ps.getProjects(member.id, org.id);
        expect(projects.length).to.equal(0);
        // have to use db directly to verify the env vars are really deleted, the env var service would throw with project not found.
        expect(await pdb.getProjectEnvironmentVariables(project1.id)).to.have.lengthOf(0);

        const project2 = await createTestProject(ps, org, owner);
        await expectError(ErrorCodes.NOT_FOUND, () => ps.deleteProject(stranger.id, project2.id));

        await ps.deleteProject(owner.id, project2.id);
        projects = await ps.getProjects(owner.id, org.id);
        expect(projects.length).to.equal(0);
    });

    it("should updateProject", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        await ps.updateProject(owner, {
            id: project.id,
            name: "Project Robot",
            settings: {
                prebuilds: { prebuildInterval: 1, enable: true, branchMatchingPattern: "feature-*" },
            },
        });
        const updatedProject1 = await ps.getProject(owner.id, project.id);
        expect(updatedProject1?.settings?.prebuilds?.prebuildInterval).to.equal(1);

        await ps.updateProject(member, {
            id: project.id,
            settings: {
                prebuilds: { prebuildInterval: 2 },
            },
        });
        const updatedProject2 = await ps.getProject(member.id, project.id);
        expect(updatedProject2.name).to.equal("Project Robot");
        expect(updatedProject2?.settings?.prebuilds?.prebuildInterval).to.equal(2);
        expect(updatedProject2?.settings?.prebuilds?.enable).to.equal(true);
        expect(updatedProject2?.settings?.prebuilds?.branchMatchingPattern).to.equal("feature-*");

        await expectError(ErrorCodes.NOT_FOUND, () =>
            ps.updateProject(stranger, {
                id: project.id,
                settings: {
                    prebuilds: { prebuildInterval: 3 },
                },
            }),
        );

        await expectError(ErrorCodes.BAD_REQUEST, () =>
            ps.updateProject(member, {
                id: project.id,
                name: " ",
                settings: {
                    prebuilds: { prebuildInterval: 3 },
                },
            }),
        );

        await expectError(ErrorCodes.BAD_REQUEST, () =>
            ps.updateProject(member, {
                id: project.id,
                name: "",
                settings: {
                    prebuilds: { prebuildInterval: 3 },
                },
            }),
        );
    });

    it("should findProjects", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);
        await createTestProject(ps, org, owner, { name: "my-project-2", cloneUrl: "https://host/account/repo.git" });
        await createTestProject(ps, org, member, { name: "my-project-3", cloneUrl: "https://host/account/repo.git" });

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

    it("prebuild settings migration / old and inactive project / uses defaults", async () => {
        const ps = container.get(ProjectsService);
        const cloneUrl = "https://github.com/gitpod-io/gitpod.git";
        const oldProject = await createTestProject(ps, org, owner, {
            name: "my-project",
            cloneUrl,
            creationTime: daysBefore(new Date().toISOString(), 20),
            settings: <OldProjectSettings>{
                enablePrebuilds: true,
                prebuildEveryNthCommit: 3,
                workspaceClasses: { prebuild: "ultra" },
                prebuildDefaultBranchOnly: false,
                prebuildBranchPattern: "feature-*",
            },
        });
        const project = await withTestCtx(owner, () => ps.getProject(owner.id, oldProject.id));
        expect(project.settings).to.deep.equal(<ProjectSettings>{
            prebuilds: {
                ...Project.PREBUILD_SETTINGS_DEFAULTS,
                enable: false,
            },
            workspaceClasses: {},
        });
    });

    it("prebuild settings migration / inactive project / uses defaults", async () => {
        const ps = container.get(ProjectsService);
        const cloneUrl = "https://github.com/gitpod-io/gitpod.git";
        const oldProject = await createTestProject(ps, org, owner, {
            name: "my-project",
            cloneUrl,
            creationTime: daysBefore(new Date().toISOString(), 1),
            settings: <OldProjectSettings>{
                enablePrebuilds: true,
                prebuildEveryNthCommit: 3,
                workspaceClasses: { prebuild: "ultra" },
                prebuildDefaultBranchOnly: false,
                prebuildBranchPattern: "feature-*",
            },
        });
        const project = await withTestCtx(owner, () => ps.getProject(owner.id, oldProject.id));
        expect(project.settings).to.deep.equal(<ProjectSettings>{
            prebuilds: {
                ...Project.PREBUILD_SETTINGS_DEFAULTS,
                enable: false,
            },
            workspaceClasses: {},
        });
    });

    it("prebuild settings migration / new and active project / updated settings", async () => {
        const ps = container.get(ProjectsService);
        const cloneUrl = "https://github.com/gitpod-io/gitpod.git";
        const oldProject = await createTestProject(ps, org, owner, {
            name: "my-project",
            cloneUrl,
            creationTime: daysBefore(new Date().toISOString(), 1),
            settings: <OldProjectSettings>{
                enablePrebuilds: true,
                prebuildEveryNthCommit: 13,
                workspaceClasses: { prebuild: "ultra" },
                prebuildDefaultBranchOnly: false,
                prebuildBranchPattern: "feature-*",
            },
        });
        await createWorkspaceForProject(oldProject.id, 1);
        const project = await withTestCtx(owner, () => ps.getProject(owner.id, oldProject.id));
        expect(project.settings).to.deep.equal(<ProjectSettings>{
            prebuilds: {
                enable: true,
                prebuildInterval: 20,
                workspaceClass: "ultra",
                branchStrategy: "matched-branches",
                branchMatchingPattern: "feature-*",
                triggerStrategy: "activity-based",
            },
            workspaceClasses: {},
        });
    });

    it("should find projects by clone url", async () => {
        const ps = container.get(ProjectsService);
        const cloneUrl = "https://github.com/gitpod-io/gitpod.git";

        await createTestProject(ps, org, owner, { name: "my-project", cloneUrl });
        await createTestProject(ps, org, owner, { name: "my-project-2", cloneUrl });

        // Create data which should not be found
        await createTestProject(ps, org, owner, {
            name: "my-project-3",
            cloneUrl: "https://github.com/gitpod-io/different-repo",
        });
        await createTestProject(ps, anotherOrg, owner, {
            name: "my-project-4",
            cloneUrl,
        });

        const foundProjects = await ps.findProjectsByCloneUrl(owner.id, cloneUrl, org.id);
        expect(foundProjects.length).to.equal(2);

        const foundProjectsForAnyOrg = await ps.findProjectsByCloneUrl(owner.id, cloneUrl);
        expect(foundProjectsForAnyOrg.length).to.equal(3);
    });

    async function createTestProject(
        ps: ProjectsService,
        org: Organization,
        owner: User,
        partial: Partial<Project> = {
            name: "my-project",
            cloneUrl: "https://github.com/gitpod-io/gitpod.git",
            settings: {
                prebuilds: Project.PREBUILD_SETTINGS_DEFAULTS,
            },
        },
    ) {
        let project = await ps.createProject(
            {
                name: partial.name!,
                slug: "deprecated",
                teamId: org.id,
                cloneUrl: partial.cloneUrl!,
                appInstallationId: "noid",
            },
            owner,
            partial.settings,
        );

        // need to patch `creationTime`?
        if (partial.creationTime) {
            const projectDB = container.get<ProjectDB>(ProjectDB);
            await projectDB.updateProject({ ...project, creationTime: partial.creationTime });
            project = (await projectDB.findProjectById(project.id))!;
        }

        return project;
    }

    async function createWorkspaceForProject(projectId: string, daysAgo: number) {
        const workspaceDB = container.get<WorkspaceDB>(WorkspaceDB);

        await workspaceDB.storePrebuiltWorkspace({
            projectId,
            id: "prebuild123",
            buildWorkspaceId: "12345",
            creationTime: daysBefore(new Date().toISOString(), daysAgo),
            cloneURL: "",
            commit: "",
            state: "available",
            statusVersion: 0,
        });
    }
});
