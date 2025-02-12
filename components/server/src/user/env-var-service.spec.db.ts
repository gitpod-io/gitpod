/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM } from "@gitpod/gitpod-db/lib";
import {
    CommitContext,
    EnvVarWithValue,
    Organization,
    OrgEnvVarWithValue,
    Project,
    User,
    UserEnvVarValue,
    WithEnvvarsContext,
    WorkspaceConfig,
} from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { createTestContainer } from "../test/service-testing-container-module";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { OrganizationService } from "../orgs/organization-service";
import { UserService } from "./user-service";
import { expectError } from "../test/expect-utils";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { EnvVarService, ResolvedEnvVars } from "./env-var-service";
import { ProjectsService } from "../projects/projects-service";

const expect = chai.expect;

const commitContext = {
    repository: {
        owner: "gitpod",
        name: "gitpod-io",
    },
    revision: "abcd123",
    title: "test",
} as CommitContext;

const fooAnyUserEnvVar = {
    name: "foo",
    value: "any",
    repositoryPattern: "gitpod/*",
} as const;

const barUserCommitEnvVar = {
    name: "bar",
    value: "commit",
    repositoryPattern: "gitpod/gitpod-io",
} as const;

const barUserAnotherCommitEnvVar = {
    name: "bar",
    value: "commit",
    repositoryPattern: "gitpod/openvscode-server",
} as const;

const barProjectCensoredEnvVar = {
    name: "bar",
    censored: true,
    value: "project1",
} as const;

const bazProjectEnvVar = {
    name: "baz",
    censored: false,
    value: "project2",
} as const;

const barContextEnvVar = {
    name: "bar",
    value: "context",
} as const;

const contextEnvVars = {
    envvars: [barContextEnvVar],
} as WithEnvvarsContext;

const gitpodImageAuthOrgEnvVar: OrgEnvVarWithValue = {
    name: "GITPOD_IMAGE_AUTH",
    value: "some-token",
};

const someOrgEnvVar: OrgEnvVarWithValue = {
    name: "SOME_ENV_VAR",
    value: "some",
};

describe("EnvVarService", async () => {
    let container: Container;
    let es: EnvVarService;

    let owner: User;
    let member: User;
    let collaborator: User;
    let stranger: User;
    let org: Organization;
    let project: Project;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({});

        const userService = container.get<UserService>(UserService);
        // create the owner (installation-level)
        owner = await userService.createUser({
            identity: {
                authId: "owner",
                authName: "ownername",
                authProviderId: "github",
                primaryEmail: "owner@yolo.com",
            },
        });

        const orgService = container.get<OrganizationService>(OrganizationService);
        org = await orgService.createOrganization(owner.id, "myOrg");

        member = await orgService.createOrgOwnedUser({
            organizationId: org.id,
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });
        await orgService.addOrUpdateMember(owner.id, org.id, member.id, "member");
        collaborator = await orgService.createOrgOwnedUser({
            organizationId: org.id,
            identity: {
                authId: "collab",
                authName: "collaborator",
                authProviderId: "github",
                primaryEmail: "collab@yolo.com",
            },
        });
        await orgService.addOrUpdateMember(owner.id, org.id, collaborator.id, "collaborator");

        stranger = await userService.createUser({
            identity: {
                authId: "foo2",
                authName: "bar2",
                authProviderId: "github",
            },
        });

        const projectsService = container.get<ProjectsService>(ProjectsService);
        project = await projectsService.createProject(
            {
                name: "my-project",
                teamId: org.id,
                cloneUrl: "https://github.com/gitpod-io/gitpod.git",
                appInstallationId: "noid",
            },
            member,
            {
                enableDockerdAuthentication: true,
            },
        );

        es = container.get(EnvVarService);
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
        // Deactivate all services
        await container.unbindAllAsync();
    });

    it("should add and update env variable", async () => {
        const resp1 = await es.listUserEnvVars(member.id, member.id);
        expect(resp1.length).to.equal(0);

        const added1 = await es.addUserEnvVar(member.id, member.id, {
            name: "var1",
            value: "foo",
            repositoryPattern: "*/*",
        });

        const resp2 = await es.listUserEnvVars(member.id, member.id);
        expect(resp2.length).to.equal(1);

        await expectError(
            ErrorCodes.BAD_REQUEST,
            es.addUserEnvVar(member.id, member.id, { name: "var1", value: "foo2", repositoryPattern: "*/*" }),
        );

        await es.updateUserEnvVar(member.id, member.id, {
            ...added1,
            name: "var1",
            value: "foo2",
            repositoryPattern: "*/*",
        });

        const resp3 = await es.listUserEnvVars(member.id, member.id);
        expect(resp3.length).to.equal(1);

        await expectError(
            ErrorCodes.NOT_FOUND,
            es.updateUserEnvVar(member.id, member.id, {
                name: "var2",
                value: "foo2",
                repositoryPattern: "*/*",
            }),
        );

        await expectError(ErrorCodes.NOT_FOUND, es.listUserEnvVars(stranger.id, member.id));
        await expectError(
            ErrorCodes.NOT_FOUND,
            es.addUserEnvVar(stranger.id, member.id, { name: "var2", value: "bar", repositoryPattern: "*/*" }),
        );
    });

    it("should list all env vars", async () => {
        await es.addUserEnvVar(member.id, member.id, { name: "var1", value: "foo", repositoryPattern: "*/*" });
        await es.addUserEnvVar(member.id, member.id, { name: "var2", value: "bar", repositoryPattern: "*/*" });

        const envVars = await es.listUserEnvVars(member.id, member.id);
        expect(envVars.length).to.equal(2);
        expect(envVars.some((e) => e.name === "var1" && e.value === "foo")).to.be.true;
        expect(envVars.some((e) => e.name === "var2" && e.value === "bar")).to.be.true;

        await expectError(ErrorCodes.NOT_FOUND, es.listUserEnvVars(stranger.id, member.id));
    });

    it("should delete env vars", async () => {
        await es.addUserEnvVar(member.id, member.id, { name: "var1", value: "foo", repositoryPattern: "*/*" });
        await es.addUserEnvVar(member.id, member.id, { name: "var2", value: "bar", repositoryPattern: "*/*" });

        const envVars = await es.listUserEnvVars(member.id, member.id);
        expect(envVars.length).to.equal(2);

        await es.deleteUserEnvVar(member.id, member.id, envVars[0]);

        const envVars2 = await es.listUserEnvVars(member.id, member.id);
        expect(envVars2.length).to.equal(1);

        await expectError(ErrorCodes.NOT_FOUND, es.deleteUserEnvVar(stranger.id, member.id, envVars2[0]));
    });

    it("should let owners create, update, delete and get project env vars", async () => {
        const added1 = await es.addProjectEnvVar(owner.id, project.id, { name: "FOO", value: "BAR", censored: false });
        await expectError(
            ErrorCodes.BAD_REQUEST,
            es.addProjectEnvVar(owner.id, project.id, { name: "FOO", value: "BAR2", censored: false }),
        );

        await es.updateProjectEnvVar(owner.id, project.id, { ...added1, name: "FOO", value: "BAR2", censored: false });
        await expectError(
            ErrorCodes.NOT_FOUND,
            es.updateProjectEnvVar(owner.id, project.id, { name: "FOO2", value: "BAR", censored: false }),
        );

        const envVars = await es.listProjectEnvVars(owner.id, project.id);
        expect(envVars[0].name).to.equal("FOO");

        const envVarById = await es.getProjectEnvVarById(owner.id, envVars[0].id);
        expect(envVarById?.name).to.equal("FOO");

        await es.deleteProjectEnvVar(owner.id, envVars[0].id);

        await expectError(ErrorCodes.NOT_FOUND, es.getProjectEnvVarById(owner.id, envVars[0].id));

        const emptyEnvVars = await es.listProjectEnvVars(owner.id, project.id);
        expect(emptyEnvVars.length).to.equal(0);
    });

    it("let members create, delete and get project env vars", async () => {
        await es.addProjectEnvVar(owner.id, project.id, { name: "FOO", value: "BAR", censored: false });

        const envVars = await es.listProjectEnvVars(member.id, project.id);
        expect(envVars[0].name).to.equal("FOO");

        const envVarById = await es.getProjectEnvVarById(member.id, envVars[0].id);
        expect(envVarById?.name).to.equal("FOO");

        await es.deleteProjectEnvVar(member.id, envVars[0].id);

        await es.addProjectEnvVar(owner.id, project.id, { name: "FOO", value: "BAR", censored: false });
    });

    it("should not let strangers create, delete and get project env vars", async () => {
        await es.addProjectEnvVar(owner.id, project.id, { name: "FOO", value: "BAR", censored: false });

        const envVars = await es.listProjectEnvVars(owner.id, project.id);
        expect(envVars[0].name).to.equal("FOO");

        // let's try to get the env var as a stranger
        await expectError(ErrorCodes.NOT_FOUND, es.getProjectEnvVarById(stranger.id, envVars[0].id));

        // let's try to delete the env var as a stranger
        await expectError(ErrorCodes.NOT_FOUND, es.deleteProjectEnvVar(stranger.id, envVars[0].id));

        // let's try to get the env vars as a stranger
        await expectError(ErrorCodes.NOT_FOUND, es.listProjectEnvVars(stranger.id, project.id));
    });

    it("should manage org-level environment variables permissions", async () => {
        // Only owner can create org env vars
        await es.addOrgEnvVar(owner.id, org.id, gitpodImageAuthOrgEnvVar);

        // Member cannot create org env vars
        await expectError(ErrorCodes.PERMISSION_DENIED, es.addOrgEnvVar(member.id, org.id, someOrgEnvVar));

        // Collaborator cannot create org env vars
        await expectError(ErrorCodes.PERMISSION_DENIED, es.addOrgEnvVar(collaborator.id, org.id, someOrgEnvVar));

        // Stranger cannot create org env vars
        await expectError(ErrorCodes.NOT_FOUND, es.addOrgEnvVar(stranger.id, org.id, someOrgEnvVar));
    });

    it("should restrict org env var names to GITPOD_IMAGE_AUTH", async () => {
        // Owner can create GITPOD_IMAGE_AUTH
        await es.addOrgEnvVar(owner.id, org.id, gitpodImageAuthOrgEnvVar);

        // Owner cannot create other env var names
        await expectError(ErrorCodes.BAD_REQUEST, es.addOrgEnvVar(owner.id, org.id, someOrgEnvVar));
    });

    it("should allow updating org env vars by owner", async () => {
        const added = await es.addOrgEnvVar(owner.id, org.id, gitpodImageAuthOrgEnvVar);

        await es.updateOrgEnvVar(owner.id, org.id, {
            ...added,
            value: "newtoken123",
        });

        const envVars = await es.listOrgEnvVars(owner.id, org.id);
        expect(envVars.length).to.equal(1);
        expect(envVars[0].name).to.equal("GITPOD_IMAGE_AUTH");
    });

    it("should control org env var read access", async () => {
        await es.addOrgEnvVar(owner.id, org.id, gitpodImageAuthOrgEnvVar);

        // Owner can read
        const ownerVars = await es.listOrgEnvVars(owner.id, org.id);
        expect(ownerVars.length).to.equal(1);

        // Member can read
        const memberVars = await es.listOrgEnvVars(member.id, org.id);
        expect(memberVars.length).to.equal(1);

        // Collaborator can read
        const collabVars = await es.listOrgEnvVars(collaborator.id, org.id);
        expect(collabVars.length).to.equal(1);

        // Stranger cannot read
        await expectError(ErrorCodes.NOT_FOUND, es.listOrgEnvVars(stranger.id, org.id));
    });

    it("should resolve env variables 1 ", async () => {
        await es.addUserEnvVar(member.id, member.id, fooAnyUserEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserCommitEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserAnotherCommitEnvVar);

        await es.addProjectEnvVar(owner.id, project.id, barProjectCensoredEnvVar);
        await es.addProjectEnvVar(owner.id, project.id, bazProjectEnvVar);

        const envVars = await es.resolveEnvVariables(member.id, project.teamId, undefined, "regular", commitContext);
        expectEnvVars(envVars, [fooAnyUserEnvVar, barUserCommitEnvVar]);
    });

    it("should resolve env variables prebuild", async () => {
        await es.addUserEnvVar(member.id, member.id, fooAnyUserEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserCommitEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserAnotherCommitEnvVar);

        await es.addProjectEnvVar(owner.id, project.id, barProjectCensoredEnvVar);
        await es.addProjectEnvVar(owner.id, project.id, bazProjectEnvVar);

        const envVars = await es.resolveEnvVariables(member.id, project.teamId, undefined, "prebuild", commitContext);
        expectEnvVars(envVars, []);
    });

    it("should resolve env variables regular project", async () => {
        await es.addUserEnvVar(member.id, member.id, fooAnyUserEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserCommitEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserAnotherCommitEnvVar);

        await es.addProjectEnvVar(owner.id, project.id, barProjectCensoredEnvVar);
        await es.addProjectEnvVar(owner.id, project.id, bazProjectEnvVar);

        const workspaceConfig: WorkspaceConfig = {
            env: {
                foobar: "yes please",
                [fooAnyUserEnvVar.name]: "overridden_by_user_var",
            },
        };

        const envVars = await es.resolveEnvVariables(
            member.id,
            project.teamId,
            project.id,
            "regular",
            commitContext,
            workspaceConfig,
        );

        expectEnvVars(envVars, [
            fooAnyUserEnvVar,
            barUserCommitEnvVar,
            bazProjectEnvVar,
            { name: "foobar", value: "yes please" },
        ]);
    });

    it("should resolve env variables regular project w/ org env vars", async () => {
        await es.addOrgEnvVar(owner.id, org.id, gitpodImageAuthOrgEnvVar);

        await es.addUserEnvVar(member.id, member.id, fooAnyUserEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserCommitEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserAnotherCommitEnvVar);

        await es.addProjectEnvVar(owner.id, project.id, barProjectCensoredEnvVar);
        await es.addProjectEnvVar(owner.id, project.id, bazProjectEnvVar);

        const workspaceConfig: WorkspaceConfig = {
            env: {
                foobar: "yes please",
                [fooAnyUserEnvVar.name]: "overridden_by_user_var",
            },
        };

        const envVars = await es.resolveEnvVariables(
            member.id,
            project.teamId,
            project.id,
            "regular",
            commitContext,
            workspaceConfig,
        );

        expectEnvVars(envVars, [
            gitpodImageAuthOrgEnvVar,
            fooAnyUserEnvVar,
            barUserCommitEnvVar,
            bazProjectEnvVar,
            { name: "foobar", value: "yes please" },
        ]);
    });

    it("user should have precedence over org, project over user", async () => {
        await es.addOrgEnvVar(owner.id, org.id, gitpodImageAuthOrgEnvVar);
        let envVars = await es.resolveEnvVariables(member.id, project.teamId, project.id, "regular", commitContext);
        expectEnvVars(envVars, [gitpodImageAuthOrgEnvVar]);

        await es.addUserEnvVar(member.id, member.id, {
            ...gitpodImageAuthOrgEnvVar,
            value: "user",
            repositoryPattern: "*/*",
        });
        envVars = await es.resolveEnvVariables(member.id, project.teamId, project.id, "regular", commitContext);
        expectEnvVars(envVars, [
            {
                ...gitpodImageAuthOrgEnvVar,
                value: "user",
            },
        ]);

        await es.addProjectEnvVar(member.id, project.id, {
            ...gitpodImageAuthOrgEnvVar,
            value: "project",
            censored: false,
        });
        envVars = await es.resolveEnvVariables(member.id, project.teamId, project.id, "regular", commitContext);
        expectEnvVars(envVars, [
            {
                ...gitpodImageAuthOrgEnvVar,
                value: "project",
            },
        ]);
    });

    it("should resolve env variables prebuild with project", async () => {
        await es.addUserEnvVar(member.id, member.id, fooAnyUserEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserCommitEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserAnotherCommitEnvVar);

        await es.addProjectEnvVar(owner.id, project.id, barProjectCensoredEnvVar);
        await es.addProjectEnvVar(owner.id, project.id, bazProjectEnvVar);

        const envVars = await es.resolveEnvVariables(member.id, project.teamId, project.id, "prebuild", commitContext);
        expectEnvVars(envVars, [barProjectCensoredEnvVar, bazProjectEnvVar]);
    });

    it("should not match single segment ", async () => {
        const userEnvVars: UserEnvVarValue[] = [
            {
                name: "USER_SINGLE_SEGMENT_NEGATIVE_TEST",
                value: "true",
                repositoryPattern: "*/*",
            },
        ];

        await es.addUserEnvVar(member.id, member.id, userEnvVars[0]);

        const envVars = await es.resolveEnvVariables(member.id, project.teamId, project.id, "prebuild", commitContext);
        expectEnvVars(envVars, []);
    });

    it("should resolve env variables from context ", async () => {
        await es.addUserEnvVar(member.id, member.id, fooAnyUserEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserCommitEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserAnotherCommitEnvVar);

        await es.addProjectEnvVar(owner.id, project.id, barProjectCensoredEnvVar);
        await es.addProjectEnvVar(owner.id, project.id, bazProjectEnvVar);

        const envVars = await es.resolveEnvVariables(member.id, project.teamId, undefined, "regular", {
            ...commitContext,
            ...contextEnvVars,
        });

        expectEnvVars(envVars, [fooAnyUserEnvVar, barContextEnvVar]);
    });

    it("should resolve env variables from context with project ", async () => {
        await es.addUserEnvVar(member.id, member.id, fooAnyUserEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserCommitEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserAnotherCommitEnvVar);

        await es.addProjectEnvVar(owner.id, project.id, barProjectCensoredEnvVar);
        await es.addProjectEnvVar(owner.id, project.id, bazProjectEnvVar);

        const envVars = await es.resolveEnvVariables(member.id, project.teamId, project.id, "regular", {
            ...commitContext,
            ...contextEnvVars,
        });

        expectEnvVars(envVars, [fooAnyUserEnvVar, barContextEnvVar, bazProjectEnvVar]);
    });

    it("should resolve env variables with precedence", async () => {
        // In this test, we'll repeatedly remove one of the entries from the top, always expecting the first one to be the one that takes precedence (because of matching rules)
        const userEnvVars = [
            {
                name: "MULTIPLE_VARS_WITH_SAME_NAME",
                value: "true",
                repositoryPattern: "gitpod/gitpod-io",
            },
            {
                name: "MULTIPLE_VARS_WITH_SAME_NAME",
                value: "true",
                repositoryPattern: "gitpod/*",
            },
            {
                name: "MULTIPLE_VARS_WITH_SAME_NAME",
                value: "true",
                repositoryPattern: "*/gitpod-io",
            },
            {
                name: "MULTIPLE_VARS_WITH_SAME_NAME",
                value: "true",
                repositoryPattern: "*/*",
            },
        ];

        for (let i = 0; i < userEnvVars.length; i++) {
            const inputVars = userEnvVars.slice(i);
            const expectedVars = [inputVars[0]];

            for (let j = 0; j < inputVars.length; j++) {
                await es.addUserEnvVar(member.id, member.id, inputVars[j]);
            }
            expectedVars.forEach((e) => delete (e as any).id);

            const envVars = await es.resolveEnvVariables(member.id, project.teamId, project.id, "regular", {
                ...commitContext,
            });

            expectEnvVars(envVars, expectedVars, `test case: ${i}`);

            for (let j = 0; j < inputVars.length; j++) {
                await es.deleteUserEnvVar(member.id, member.id, inputVars[j]);
            }
        }
    });

    it("should resolve env variables in Gitlab subgroup with user EnvVars", async () => {
        const gitlabSubgroupCommitContext = {
            repository: {
                owner: "geropl-test-group/subgroup1",
                name: "test-project-1",
            },
            revision: "abcd123",
            title: "geropl-test-group/subgroup1/test-project-1",
        } as CommitContext;

        const userEnvVars = [
            {
                name: "USER_GLOBAL_TEST",
                value: "true",
                repositoryPattern: "*/**",
            },
            {
                name: "USER_GROUP_TEST",
                value: "true",
                repositoryPattern: "geropl-test-group/**",
            },
            {
                name: "USER_SUBGROUP_TEST",
                value: "true",
                repositoryPattern: "geropl-test-group/subgroup1/*",
            },
            {
                name: "USER_SUBGROUP_PROJECT_NEGATIVE_TEST",
                value: "false",
                repositoryPattern: "*/test-project-1",
            },
            {
                name: "USER_SUBGROUP_STAR_TEST",
                value: "true",
                repositoryPattern: "geropl-test-group/*/*",
            },
            {
                name: "USER_SUBGROUP_NEGATIVE_TEST",
                value: "false",
                repositoryPattern: "geropl-test-group/subgroup2/*",
            },
            {
                name: "USER_SUBGROUP_PROJECT_TEST",
                value: "true",
                repositoryPattern: "*/subgroup1/test-project-1",
            },
        ];

        for (let j = 0; j < userEnvVars.length; j++) {
            await es.addUserEnvVar(member.id, member.id, userEnvVars[j]);
        }

        const envVars = await es.resolveEnvVariables(member.id, project.teamId, project.id, "regular", {
            ...gitlabSubgroupCommitContext,
        });
        expectEnvVars(
            envVars,
            userEnvVars.filter((ev) => ev.value === "true"),
        );
    });
});

function envVars(evs: EnvVarWithValue[]): Pick<EnvVarWithValue, "name" | "value">[] {
    return evs.map((ev) => {
        return {
            name: ev.name,
            value: ev.value,
        };
    });
}

function expectEnvVars(resolved: ResolvedEnvVars, expected: EnvVarWithValue[], message?: string) {
    expect(envVars(resolved.workspace), message).to.have.deep.members(envVars(expected));
}
