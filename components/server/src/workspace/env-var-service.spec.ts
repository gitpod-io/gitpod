/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import { EnvVarService } from "./env-var-service";
import {
    CommitContext,
    EnvVarWithValue,
    ProjectEnvVar,
    ProjectEnvVarWithValue,
    UserEnvVar,
    WithEnvvarsContext,
} from "@gitpod/gitpod-protocol";
import { ProjectDB, UserDB } from "@gitpod/gitpod-db/lib";
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

const fooAnyUserEnvVar: UserEnvVar = {
    id: "1",
    name: "foo",
    value: "any",
    repositoryPattern: "gitpod/*",
    userId: "1",
};

const barUserCommitEnvVar: UserEnvVar = {
    id: "2",
    name: "bar",
    value: "commit",
    repositoryPattern: "gitpod/gitpod-io",
    userId: "1",
};

const barUserAnotherCommitEnvVar: UserEnvVar = {
    id: "5",
    name: "bar",
    value: "commit",
    repositoryPattern: "gitpod/openvscode-server",
    userId: "1",
};

const barProjectCensoredEnvVar: ProjectEnvVarWithValue = {
    id: "3",
    name: "bar",
    projectId: "1",
    censored: true,
    value: "project1",
};

const bazProjectEnvVar: ProjectEnvVarWithValue = {
    id: "4",
    name: "baz",
    projectId: "1",
    censored: false,
    value: "project2",
};

const barContextEnvVar: EnvVarWithValue = {
    name: "bar",
    value: "context",
};
const contextEnvVars = {
    envvars: [barContextEnvVar],
} as WithEnvvarsContext;

@suite
class TestEnvVarService {
    protected envVarService: EnvVarService;

    protected init(userEnvVars: UserEnvVar[], projectEnvVar: ProjectEnvVarWithValue[]) {
        this.envVarService = new EnvVarService();
        this.envVarService["userDB"] = {
            getEnvVars: (_) => {
                return Promise.resolve(userEnvVars);
            },
        } as UserDB;
        this.envVarService["projectsService"] = {
            getProjectEnvironmentVariables: (_) => {
                return Promise.resolve(projectEnvVar as ProjectEnvVar[]);
            },
        } as ProjectsService;
        this.envVarService["projectDB"] = {
            getProjectEnvironmentVariableValues: (envs) => {
                return Promise.resolve(envs as ProjectEnvVarWithValue[]);
            },
        } as ProjectDB;
    }

    public before() {
        this.init([], []);
    }

    @test
    public async testRegular() {
        this.init(
            [fooAnyUserEnvVar, barUserCommitEnvVar, barUserAnotherCommitEnvVar],
            [barProjectCensoredEnvVar, bazProjectEnvVar],
        );
        const envVars = await this.envVarService.resolve({
            ownerId: "1",
            type: "regular",
            context: commitContext,
        } as any);
        expect(envVars).to.deep.equal({
            project: [],
            workspace: [fooAnyUserEnvVar, barUserCommitEnvVar],
        });
    }

    @test
    public async testPrebuild() {
        this.init(
            [fooAnyUserEnvVar, barUserCommitEnvVar, barUserAnotherCommitEnvVar],
            [barProjectCensoredEnvVar, bazProjectEnvVar],
        );
        const envVars = await this.envVarService.resolve({
            ownerId: "1",
            type: "prebuild",
            context: commitContext,
        } as any);
        expect(envVars).to.deep.equal({
            project: [],
            workspace: [],
        });
    }

    @test
    public async testRegularWithProject() {
        this.init(
            [fooAnyUserEnvVar, barUserCommitEnvVar, barUserAnotherCommitEnvVar],
            [barProjectCensoredEnvVar, bazProjectEnvVar],
        );
        const envVars = await this.envVarService.resolve({
            ownerId: "1",
            type: "regular",
            context: commitContext,
            projectId: "1",
        } as any);
        expect(envVars).to.deep.equal({
            project: [barProjectCensoredEnvVar, bazProjectEnvVar],
            workspace: [fooAnyUserEnvVar, barUserCommitEnvVar, bazProjectEnvVar],
        });
    }

    @test
    public async testPrebuildWithProject() {
        this.init(
            [fooAnyUserEnvVar, barUserCommitEnvVar, barUserAnotherCommitEnvVar],
            [barProjectCensoredEnvVar, bazProjectEnvVar],
        );
        const envVars = await this.envVarService.resolve({
            type: "prebuild",
            context: commitContext,
            projectId: "1",
        } as any);
        expect(envVars).to.deep.equal({
            project: [barProjectCensoredEnvVar, bazProjectEnvVar],
            workspace: [barProjectCensoredEnvVar, bazProjectEnvVar],
        });
    }

    @test
    public async testDontMatchSingleSegment() {
        const userEnvVars: UserEnvVar[] = [
            {
                id: "1",
                name: "USER_SINGLE_SEGMENT_NEGATIVE_TEST",
                value: "true",
                repositoryPattern: "*",
                userId: "1",
            },
        ];

        this.init(userEnvVars, []);

        const envVars = await this.envVarService.resolve({
            ownerId: "1",
            type: "regular",
            context: commitContext,
            projectId: "1",
        } as any);
        expect(envVars).to.deep.equal({
            project: [],
            workspace: [],
        });
    }

    @test
    public async testRegularFromContext() {
        this.init(
            [fooAnyUserEnvVar, barUserCommitEnvVar, barUserAnotherCommitEnvVar],
            [barProjectCensoredEnvVar, bazProjectEnvVar],
        );
        const envVars = await this.envVarService.resolve({
            owerId: "1",
            type: "regular",
            context: { ...commitContext, ...contextEnvVars },
        } as any);
        expect(envVars).to.deep.equal({
            project: [],
            workspace: [fooAnyUserEnvVar, barContextEnvVar],
        });
    }

    @test
    public async testRegularFromContextWithProject() {
        this.init(
            [fooAnyUserEnvVar, barUserCommitEnvVar, barUserAnotherCommitEnvVar],
            [barProjectCensoredEnvVar, bazProjectEnvVar],
        );
        const envVars = await this.envVarService.resolve({
            owerId: "1",
            type: "regular",
            context: { ...commitContext, ...contextEnvVars },
            projectId: "1",
        } as any);
        expect(envVars).to.deep.equal({
            project: [barProjectCensoredEnvVar, bazProjectEnvVar],
            workspace: [fooAnyUserEnvVar, barContextEnvVar, bazProjectEnvVar],
        });
    }

    @test
    public async testPrecedence() {
        // In this test, we'll repeatedly remove one of the entries from the top, always expecting the first one to be the one that takes precedence (because of matching rules)
        const userEnvVars: UserEnvVar[] = [
            {
                id: "1",
                name: "MULTIPLE_VARS_WITH_SAME_NAME",
                value: "true",
                repositoryPattern: "gitpod/gitpod-io",
                userId: "1",
            },
            {
                id: "2",
                name: "MULTIPLE_VARS_WITH_SAME_NAME",
                value: "true",
                repositoryPattern: "gitpod/*",
                userId: "1",
            },
            {
                id: "3",
                name: "MULTIPLE_VARS_WITH_SAME_NAME",
                value: "true",
                repositoryPattern: "*/gitpod-io",
                userId: "1",
            },
            {
                id: "4",
                name: "MULTIPLE_VARS_WITH_SAME_NAME",
                value: "true",
                repositoryPattern: "*/*",
                userId: "1",
            },
        ];

        for (let i = 0; i < userEnvVars.length; i++) {
            const inputVars = userEnvVars.slice(i);
            const expectedVars = [inputVars[0]];

            this.init(inputVars, []);
            const envVars = await this.envVarService.resolve({
                owerId: "1",
                type: "regular",
                context: { ...commitContext },
                projectId: "1",
            } as any);
            expect(envVars, `test case: ${i}`).to.deep.equal({
                project: [],
                workspace: expectedVars,
            });
        }
    }

    @test
    public async testRegularGitlabSubgroupWithUserEnvVars() {
        const gitlabSubgroupCommitContext = {
            repository: {
                owner: "geropl-test-group/subgroup1",
                name: "test-project-1",
            },
            revision: "abcd123",
            title: "geropl-test-group/subgroup1/test-project-1",
        } as CommitContext;

        const userEnvVars: UserEnvVar[] = [
            {
                id: "1",
                name: "USER_GLOBAL_TEST",
                value: "true",
                repositoryPattern: "*/*",
                userId: "1",
            },
            {
                id: "2",
                name: "USER_GROUP_TEST",
                value: "true",
                repositoryPattern: "geropl-test-group/*",
                userId: "1",
            },
            {
                id: "3",
                name: "USER_SUBGROUP_TEST",
                value: "true",
                repositoryPattern: "geropl-test-group/subgroup1/*",
                userId: "1",
            },
            {
                id: "4",
                name: "USER_SUBGROUP_PROJECT_NEGATIVE_TEST",
                value: "false",
                repositoryPattern: "*/test-project-1",
                userId: "1",
            },
            {
                id: "5",
                name: "USER_SUBGROUP_STAR_TEST",
                value: "true",
                repositoryPattern: "geropl-test-group/*/*",
                userId: "1",
            },
            {
                id: "6",
                name: "USER_SUBGROUP_NEGATIVE_TEST",
                value: "false",
                repositoryPattern: "geropl-test-group/subgroup2/*",
                userId: "1",
            },
            {
                id: "7",
                name: "USER_SUBGROUP_PROJECT_TEST",
                value: "true",
                repositoryPattern: "*/subgroup1/test-project-1",
                userId: "1",
            },
        ];

        this.init(userEnvVars, []);

        const envVars = await this.envVarService.resolve({
            owerId: "1",
            type: "regular",
            context: { ...gitlabSubgroupCommitContext },
            projectId: "1",
        } as any);
        expect(envVars).to.deep.equal({
            project: [],
            workspace: userEnvVars.filter((ev) => ev.value === "true"),
        });
    }
}

module.exports = new TestEnvVarService();
