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
const expect = chai.expect;

@suite(timeout(10000))
export class WorkspaceSpec {
    private readonly wsDB = testContainer.get<WorkspaceDB>(WorkspaceDB);

    readonly org = randomUUID();
    readonly strangerOrg = randomUUID();

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
                contextURL: "https://github.com/gitpod-io/gitpod",
                description: "Gitpod",
                ownerId: randomUUID(),
                projectId: randomUUID(),
                context: {
                    title: "Gitpod",
                },
                config: {},
            });

            await this.wsDB.storePrebuiltWorkspace({
                id: prebuildId,
                cloneURL: "https://github.com/gitpod-io/gitpod",
                commit: "aeioufg",
                buildWorkspaceId: ws.id,
                creationTime: now,
                state,
                error,
                statusVersion: 1,
            });

            await this.wsDB.storePrebuildInfo({
                teamId: this.org,
                id: randomUUID(),
                buildWorkspaceId: ws.id,
                projectId: "gitpod",
                projectName: "Gitpod",
                cloneUrl: "https://github.com/gitpod-io/gitpod",
                branch: "main",
                startedAt: now,
                startedBy: "me",
                changeTitle: "Change this",
                changeDate: now,
                changeAuthor: "me again",
                changeHash: "aeioufg",
            });
        }
    }

    @test()
    async testPrebuildLookupByOrg(): Promise<void> {
        await this.setupPrebuilds();

        const orgLookup = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            { limit: 10, offset: 0 },
            {},
            { field: "creationTime", order: "ASC" },
        );
        expect(orgLookup).length(7);

        const strangerOrgLookup = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.strangerOrg,
            { limit: 10, offset: 0 },
            {},
            { field: "creationTime", order: "ASC" },
        );
        expect(strangerOrgLookup).length(0);
    }

    @test()
    async testPrebuildLookupByOrgWithFilters(): Promise<void> {
        await this.setupPrebuilds();

        const stateUnfinished = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            { limit: 10, offset: 0 },
            { state: "unfinished" },
            { field: "creationTime", order: "ASC" },
        );
        expect(stateUnfinished).length(2);

        const stateFailed = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            { limit: 10, offset: 0 },
            { state: "failed" },
            { field: "creationTime", order: "ASC" },
        );
        expect(stateFailed).length(4);

        const stateSucceeded = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            { limit: 10, offset: 0 },
            { state: "succeeded" },
            { field: "creationTime", order: "ASC" },
        );
        expect(stateSucceeded).length(1);
    }

    @test()
    async testPrebuildLookupByOrgPagination(): Promise<void> {
        await this.setupPrebuilds();

        const firstPage = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            { limit: 3, offset: 0 },
            {},
            { field: "creationTime", order: "ASC" },
        );
        expect(firstPage).length(3);

        const secondPage = await this.wsDB.findPrebuiltWorkspacesByOrganization(
            this.org,
            { limit: 3, offset: 3 },
            {},
            { field: "creationTime", order: "ASC" },
        );
        expect(secondPage).length(3);
        expect(secondPage[0].id).not.eq(firstPage[0].id);
    }
}
