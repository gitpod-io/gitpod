/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test, timeout } from "@testdeck/mocha";
import { testContainer } from "../test-container";
import { TypeORM } from "./typeorm";
import * as chai from "chai";
import { resetDB } from "../test/reset-db";
import { WorkspaceDB } from "../workspace-db";
import { randomUUID } from "crypto";
import { PrebuiltWorkspaceState } from "@gitpod/gitpod-protocol";
import { ProjectDB } from "../project-db";
const expect = chai.expect;

@suite(timeout(10000))
export class WorkspaceSpec {
    private readonly wsDB = testContainer.get<WorkspaceDB>(WorkspaceDB);
    private readonly projectDB = testContainer.get<ProjectDB>(ProjectDB);

    readonly org = randomUUID();
    readonly strangerOrg = randomUUID();

    readonly configuration = {
        cloneUrl: "https://github.com/gitpod-io/gitpod",
        id: randomUUID(),
        branch: "main",
        commit: "3fedc3251be3f917d9e44f5f3d785e21153e067e",
    };

    readonly defaultSorting = { field: "creationTime", order: "ASC" } as const;
    readonly defaultPagination = { limit: 10, offset: 0 };

    async before() {
        await this.wipeRepo();
    }

    async after() {
        await this.wipeRepo();
    }

    async wipeRepo() {
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        await resetDB(typeorm);
    }

    protected async setupPrebuilds() {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const now = new Date().toISOString();

        const states: PrebuiltWorkspaceState[] = [
            "queued",
            "building",
            "aborted",
            "timeout",
            "available",
            "available",
            "failed",
        ];
        const errors = [undefined, undefined, undefined, undefined, "failed", undefined, undefined];

        await this.projectDB.storeProject({
            id: this.configuration.id,
            name: "gitpod",
            cloneUrl: this.configuration.cloneUrl,
            teamId: this.org,
            appInstallationId: randomUUID(),
            creationTime: now,
        });

        const fakeConfiguration = {
            id: randomUUID(),
            cloneUrl: "https://github.com/gitpod-io/gitpod",
            branch: "main",
            commit: "1676c9001cdf291d27f48bd18b40b773dd24748b",
        };

        for (const configuration of [this.configuration, fakeConfiguration]) {
            // Mock all possible states (including two possible states for "available" with and without an error value)
            for (let i = 0; i < states.length; i++) {
                const prebuildId = randomUUID();
                const workspaceId = randomUUID();
                const state = states[i];
                const error = errors[i];

                const ws = await this.wsDB.store({
                    id: workspaceId,
                    type: "prebuild",
                    creationTime: now,
                    organizationId: this.org,
                    contextURL: configuration.cloneUrl,
                    description: "Gitpod",
                    ownerId: randomUUID(),
                    projectId: configuration.id,
                    context: {
                        title: "Gitpod",
                        ref: configuration.branch,
                    },
                    config: {},
                });

                await this.wsDB.storePrebuiltWorkspace({
                    id: prebuildId,
                    cloneURL: configuration.cloneUrl,
                    commit: configuration.commit,
                    projectId: configuration.id,
                    buildWorkspaceId: ws.id,
                    creationTime: now,
                    branch: configuration.branch,
                    state,
                    error,
                    statusVersion: 1,
                });

                await this.wsDB.storePrebuildInfo({
                    teamId: this.org,
                    id: randomUUID(),
                    buildWorkspaceId: ws.id,
                    projectId: configuration.id,
                    projectName: "gitpod",
                    cloneUrl: configuration.cloneUrl,
                    branch: configuration.branch,
                    startedAt: now,
                    startedBy: "me",
                    changeTitle: "Change this",
                    changeDate: now,
                    changeAuthor: "me again",
                    changeHash: configuration.commit,
                });
            }
        }
    }

    @test()
    async testPrebuildLookupByOrg(): Promise<void> {
        await this.setupPrebuilds();

        const orgLookup = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            this.defaultPagination,
            {},
            this.defaultSorting,
        );
        expect(orgLookup).length(7);

        const strangerOrgLookup = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.strangerOrg,
            this.defaultPagination,
            {},
            this.defaultSorting,
        );
        expect(strangerOrgLookup).length(0);
    }

    @test()
    async testPrebuildLookupByOrgWithStateFilters(): Promise<void> {
        await this.setupPrebuilds();

        const stateUnfinished = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            this.defaultPagination,
            { state: "unfinished" },
            this.defaultSorting,
        );
        expect(stateUnfinished).length(2);

        const stateFailed = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            this.defaultPagination,
            { state: "failed" },
            this.defaultSorting,
        );
        expect(stateFailed).length(4);

        const stateSucceeded = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            this.defaultPagination,
            { state: "succeeded" },
            this.defaultSorting,
        );
        expect(stateSucceeded).length(1);
    }

    @test()
    async testPrebuildLookupByOrgWithConfigurationFilter(): Promise<void> {
        await this.setupPrebuilds();

        const filtered = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            this.defaultPagination,
            { configuration: { id: this.configuration.id } },
            this.defaultSorting,
        );
        expect(filtered).length(7);

        const filteredNonExistent = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            this.defaultPagination,
            { configuration: { id: "nonexistent" } },
            this.defaultSorting,
        );
        expect(filteredNonExistent).length(0);

        const filteredBranch = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            this.defaultPagination,
            { configuration: { id: this.configuration.id, branch: this.configuration.branch } },
            this.defaultSorting,
        );
        expect(filteredBranch).length(7);

        const filteredBranchNonExistent = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            this.defaultPagination,
            { configuration: { id: this.configuration.id, branch: "nonexistent" } },
            this.defaultSorting,
        );
        expect(filteredBranchNonExistent).length(0);
    }

    @test()
    async testPrebuildLookupByOrgPagination(): Promise<void> {
        await this.setupPrebuilds();

        const firstPage = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            { limit: 3, offset: 0 },
            {},
            this.defaultSorting,
        );
        expect(firstPage).length(3);

        const secondPage = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            { limit: 3, offset: 3 },
            {},
            this.defaultSorting,
        );
        expect(secondPage).length(3);
        expect(secondPage[0].id).not.eq(firstPage[0].id);
    }
}
