/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { testContainer } from "../test-container";
import { TypeORM } from "../typeorm/typeorm";
import { v4 as uuidv4 } from "uuid";
import { WorkspaceDB } from "../workspace-db";
import { WorkspaceOrganizationIdMigration } from "./workspace-organizationid-migration";
const expect = chai.expect;

describe("Workspace organizationid migration", () => {
    const typeORM = testContainer.get<TypeORM>(TypeORM);
    const migrationService = testContainer.get<WorkspaceOrganizationIdMigration>(WorkspaceOrganizationIdMigration);
    const workspaceDB = testContainer.get<WorkspaceDB>(WorkspaceDB);

    const wipeRepo = async () => {
        const conn = await typeORM.getConnection();
        await conn.query("DELETE FROM d_b_workspace");
        await conn.query("DELETE FROM d_b_workspace_instance");
    };

    it("should migrate", async () => {
        await wipeRepo();
        const orgId = uuidv4();

        const now = new Date();
        const ws = await workspaceDB.store({
            id: "workspace-id",
            description: "workspace-description",
            creationTime: now.toISOString(),
            contextURL: "workspace-contextURL",
            context: { title: "workspace-context-title" },
            ownerId: uuidv4(),
            type: "regular",
            config: { image: "workspace-config-image" },
        });
        await workspaceDB.storeInstance({
            id: "workspace-instance-id",
            workspaceId: ws.id,
            creationTime: now.toISOString(),
            usageAttributionId: `team:${orgId}`,
            ideUrl: "workspace-instance-ideUrl",
            region: "workspace-instance-region",
            workspaceImage: "workspace-instance-workspaceImage",
            status: {
                phase: "stopped",
                conditions: {},
            },
        });

        const oldWorkspaceTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const ws1 = await workspaceDB.store({
            id: "workspace-id1",
            description: "workspace-description",
            creationTime: oldWorkspaceTime.toISOString(),
            contextURL: "workspace-contextURL",
            context: { title: "workspace-context-title" },
            ownerId: uuidv4(),
            type: "regular",
            config: { image: "workspace-config-image" },
        });
        await workspaceDB.storeInstance({
            id: "workspace-instance-id1",
            workspaceId: ws1.id,
            creationTime: oldWorkspaceTime.toISOString(),
            usageAttributionId: `team:${orgId}`,
            ideUrl: "workspace-instance-ideUrl",
            region: "workspace-instance-region",
            workspaceImage: "workspace-instance-workspaceImage",
            status: {
                phase: "stopped",
                conditions: {},
            },
        });

        const conn = await typeORM.getConnection();
        const getMigrationCount = async () => {
            const result = await conn.query(
                `SELECT count(*) as migrated FROM d_b_workspace WHERE organizationId='${orgId}'`,
            );
            return Number.parseInt(result[0].migrated);
        };

        expect(await getMigrationCount()).to.be.eq(0);

        await migrationService.runMigrationBatch();

        expect(await getMigrationCount()).to.be.eq(1);

        await migrationService.runMigrationBatch();

        expect(await getMigrationCount()).to.be.eq(2);
    });
});
