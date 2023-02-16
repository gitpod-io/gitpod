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

    public before() {
        this.envVarService = new EnvVarService();
        this.envVarService["userDB"] = {
            getEnvVars: (_) => {
                return Promise.resolve([fooAnyUserEnvVar, barUserCommitEnvVar, barUserAnotherCommitEnvVar]);
            },
        } as UserDB;
        this.envVarService["projectsService"] = {
            getProjectEnvironmentVariables: (_) => {
                return Promise.resolve([barProjectCensoredEnvVar, bazProjectEnvVar] as ProjectEnvVar[]);
            },
        } as ProjectsService;
        this.envVarService["projectDB"] = {
            getProjectEnvironmentVariableValues: (envs) => {
                return Promise.resolve(envs as ProjectEnvVarWithValue[]);
            },
        } as ProjectDB;
    }

    @test
    public async testRegular() {
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
    public async testRegularFromContext() {
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
}

module.exports = new TestEnvVarService();
