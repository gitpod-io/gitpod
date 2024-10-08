/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BUILTIN_INSTLLATION_ADMIN_USER_ID, TypeORM } from "@gitpod/gitpod-db/lib";
import {
    CommitContext,
    // EnvVarWithValue,
    Organization,
    Project,
    User,
    UserEnvVarValue,
    WithEnvvarsContext,
} from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { createTestContainer, withTestCtx } from "../test/service-testing-container-module";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { OrganizationService } from "../orgs/organization-service";
import { UserService } from "./user-service";
import { expectError } from "../test/expect-utils";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { EnvVarService } from "./env-var-service";
import { ProjectsService } from "../projects/projects-service";
import { SYSTEM_USER } from "../authorization/authorizer";

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
};

const barUserCommitEnvVar = {
    name: "bar",
    value: "commit",
    repositoryPattern: "gitpod/gitpod-io",
};

const barUserAnotherCommitEnvVar = {
    name: "bar",
    value: "commit",
    repositoryPattern: "gitpod/openvscode-server",
};

const barProjectCensoredEnvVar = {
    name: "bar",
    censored: true,
    value: "project1",
};

const bazProjectEnvVar = {
    name: "baz",
    censored: false,
    value: "project2",
};

const barContextEnvVar = {
    name: "bar",
    value: "context",
};

const contextEnvVars = {
    envvars: [barContextEnvVar],
} as WithEnvvarsContext;

describe("EnvVarService", async () => {
    let container: Container;
    let es: EnvVarService;

    let owner: User;
    let member: User;
    let stranger: User;
    let org: Organization;
    let project: Project;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({});

        const userService = container.get<UserService>(UserService);
        owner = await userService.findUserById(BUILTIN_INSTLLATION_ADMIN_USER_ID, BUILTIN_INSTLLATION_ADMIN_USER_ID);

        const orgService = container.get<OrganizationService>(OrganizationService);
        org = await orgService.createOrganization(BUILTIN_INSTLLATION_ADMIN_USER_ID, "myOrg");
        const invite = await orgService.getOrCreateInvite(BUILTIN_INSTLLATION_ADMIN_USER_ID, org.id);

        member = await userService.createUser({
            organizationId: org.id,
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });
        await withTestCtx(SYSTEM_USER, () => orgService.joinOrganization(member.id, invite.id));
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

    it("should resolve env variables 1 ", async () => {
        await es.addUserEnvVar(member.id, member.id, fooAnyUserEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserCommitEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserAnotherCommitEnvVar);

        await es.addProjectEnvVar(owner.id, project.id, barProjectCensoredEnvVar);
        await es.addProjectEnvVar(owner.id, project.id, bazProjectEnvVar);

        const envVars = await es.resolveEnvVariables(member.id, undefined, "regular", commitContext);
        envVars.workspace.forEach((e) => {
            delete (e as any).id;
            delete (e as any).userId;
            delete (e as any).deleted;
        });
        expect(envVars.project.length).to.be.equal(0);
        expect(envVars.workspace).to.have.deep.members([fooAnyUserEnvVar, barUserCommitEnvVar]);
    });

    it("should resolve env variables prebuild", async () => {
        await es.addUserEnvVar(member.id, member.id, fooAnyUserEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserCommitEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserAnotherCommitEnvVar);

        await es.addProjectEnvVar(owner.id, project.id, barProjectCensoredEnvVar);
        await es.addProjectEnvVar(owner.id, project.id, bazProjectEnvVar);

        const envVars = await es.resolveEnvVariables(member.id, undefined, "prebuild", commitContext);
        expect(envVars).to.deep.equal({
            project: [],
            workspace: [],
        });
    });

    it("should resolve env variables regular projext", async () => {
        await es.addUserEnvVar(member.id, member.id, fooAnyUserEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserCommitEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserAnotherCommitEnvVar);

        await es.addProjectEnvVar(owner.id, project.id, barProjectCensoredEnvVar);
        await es.addProjectEnvVar(owner.id, project.id, bazProjectEnvVar);

        const envVars = await es.resolveEnvVariables(member.id, project.id, "regular", commitContext);
        envVars.project.forEach((e) => {
            delete (e as any).id;
            delete (e as any).projectId;
            delete (e as any).creationTime;
            delete (e as any).deleted;
        });
        envVars.workspace.forEach((e) => {
            delete (e as any).id;
            delete (e as any).projectId;
            delete (e as any).userId;
            delete (e as any).creationTime;
            delete (e as any).deleted;
        });
        expect(envVars.project).to.have.deep.members(
            [barProjectCensoredEnvVar, bazProjectEnvVar].map((e) => ({
                name: e.name,
                censored: e.censored,
            })),
        );
        expect(envVars.workspace).to.have.deep.members([fooAnyUserEnvVar, barUserCommitEnvVar, bazProjectEnvVar]);
    });

    it("should resolve env variables prebuild with projext ", async () => {
        await es.addUserEnvVar(member.id, member.id, fooAnyUserEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserCommitEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserAnotherCommitEnvVar);

        await es.addProjectEnvVar(owner.id, project.id, barProjectCensoredEnvVar);
        await es.addProjectEnvVar(owner.id, project.id, bazProjectEnvVar);

        const envVars = await es.resolveEnvVariables(member.id, project.id, "prebuild", commitContext);
        envVars.project.forEach((e) => {
            delete (e as any).id;
            delete (e as any).projectId;
            delete (e as any).creationTime;
            delete (e as any).deleted;
        });
        envVars.workspace.forEach((e) => {
            delete (e as any).id;
            delete (e as any).projectId;
            delete (e as any).creationTime;
            delete (e as any).deleted;
        });
        expect(envVars.project).to.have.deep.members(
            [barProjectCensoredEnvVar, bazProjectEnvVar].map((e) => ({
                name: e.name,
                censored: e.censored,
            })),
        );
        expect(envVars.workspace).to.have.deep.members([barProjectCensoredEnvVar, bazProjectEnvVar]);
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

        const envVars = await es.resolveEnvVariables(member.id, project.id, "prebuild", commitContext);
        expect(envVars).to.deep.equal({
            project: [],
            workspace: [],
        });
    });

    it("should resolve env variables from context ", async () => {
        await es.addUserEnvVar(member.id, member.id, fooAnyUserEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserCommitEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserAnotherCommitEnvVar);

        await es.addProjectEnvVar(owner.id, project.id, barProjectCensoredEnvVar);
        await es.addProjectEnvVar(owner.id, project.id, bazProjectEnvVar);

        const envVars = await es.resolveEnvVariables(member.id, undefined, "regular", {
            ...commitContext,
            ...contextEnvVars,
        });
        envVars.workspace.forEach((e) => {
            delete (e as any).id;
            delete (e as any).userId;
            delete (e as any).deleted;
        });
        expect(envVars.project.length).to.be.equal(0);
        expect(envVars.workspace).to.have.deep.members([fooAnyUserEnvVar, barContextEnvVar]);
    });

    it("should resolve env variables from context with project ", async () => {
        await es.addUserEnvVar(member.id, member.id, fooAnyUserEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserCommitEnvVar);
        await es.addUserEnvVar(member.id, member.id, barUserAnotherCommitEnvVar);

        await es.addProjectEnvVar(owner.id, project.id, barProjectCensoredEnvVar);
        await es.addProjectEnvVar(owner.id, project.id, bazProjectEnvVar);

        const envVars = await es.resolveEnvVariables(member.id, project.id, "regular", {
            ...commitContext,
            ...contextEnvVars,
        });
        envVars.project.forEach((e) => {
            delete (e as any).id;
            delete (e as any).projectId;
            delete (e as any).userId;
            delete (e as any).creationTime;
            delete (e as any).deleted;
        });
        envVars.workspace.forEach((e) => {
            delete (e as any).id;
            delete (e as any).projectId;
            delete (e as any).userId;
            delete (e as any).creationTime;
            delete (e as any).deleted;
        });
        expect(envVars.project).to.have.deep.members(
            [barProjectCensoredEnvVar, bazProjectEnvVar].map((e) => ({
                name: e.name,
                censored: e.censored,
            })),
        );
        expect(envVars.workspace).to.have.deep.members([fooAnyUserEnvVar, barContextEnvVar, bazProjectEnvVar]);
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

            const envVars = await es.resolveEnvVariables(member.id, project.id, "regular", { ...commitContext });
            envVars.workspace.forEach((e) => {
                delete (e as any).id;
                delete (e as any).userId;
                delete (e as any).deleted;
            });
            expect(envVars, `test case: ${i}`).to.deep.equal({
                project: [],
                workspace: expectedVars,
            });

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

        const envVars = await es.resolveEnvVariables(member.id, project.id, "regular", {
            ...gitlabSubgroupCommitContext,
        });
        envVars.workspace.forEach((e) => {
            delete (e as any).id;
            delete (e as any).userId;
            delete (e as any).deleted;
        });
        expect(envVars.project.length).to.be.equal(0);
        expect(envVars.workspace).to.have.deep.members(userEnvVars.filter((ev) => ev.value === "true"));
    });
});
