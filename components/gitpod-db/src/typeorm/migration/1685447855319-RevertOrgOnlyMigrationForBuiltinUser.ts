/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class RevertOrgOnlyMigrationForBuiltinUser1685447855319 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Unset shouldSeeMigrationMessage, usageAttributionId for all technical users
        queryRunner.query(
            "UPDATE d_b_user SET usageAttributionId = '', additionalData = JSON_REMOVE(additionalData, '$.shouldSeeMigrationMessage') WHERE id IN ('builtin-user-workspace-probe-0000000', 'builtin-user-agent-smith-0000000', 'f071bb8e-b5d1-46cf-a436-da03ae63bcd2')",
        );
        // Set isMigratedToTeamOnlyAttribution for all technical users
        queryRunner.query(
            "UPDATE d_b_user SET additionalData = JSON_SET(additionalData, '$.isMigratedToTeamOnlyAttribution', TRUE) WHERE id IN ('builtin-user-workspace-probe-0000000', 'builtin-user-agent-smith-0000000', 'f071bb8e-b5d1-46cf-a436-da03ae63bcd2')",
        );

        // Delete all cost centers added by UserToTeamMigrationService
        // We need to go by name because due to another bug, we might have created n organizations
        queryRunner.query(
            "DELETE FROM d_b_cost_center WHERE id = (SELECT CONCAT('team:', id) FROM d_b_team WHERE name = 'agent-smith')",
        );
        queryRunner.query(
            "DELETE FROM d_b_cost_center WHERE id = (SELECT CONCAT('team:', id) FROM d_b_team WHERE name = 'builtin-workspace-prober')",
        );

        // Delete the create organizations
        // We need to go by name because due to another bug, we might have created n organizations
        queryRunner.query(
            "DELETE FROM d_b_team_membership WHERE teamId IN (SELECT id FROM d_b_team WHERE name = 'agent-smith' OR name = 'builtin-workspace-prober' or name = 'admin-user')",
        );
        queryRunner.query(
            "DELETE FROM d_b_team WHERE name = 'agent-smith' OR name = 'builtin-workspace-prober' or name = 'admin-user'",
        );

        // We don't care about projects, workspaces and instances because there shouldn't be any, really.
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
