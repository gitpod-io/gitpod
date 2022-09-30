/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class DeleteProbeWorkspacesAndInstances1664524890935 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // first we delete workspace instances
        await queryRunner.query(
            `DELETE FROM d_b_workspace_instance WHERE workspaceId IN (SELECT id AS workspaceId FROM d_b_workspace WHERE type = 'probe')`,
        );

        // second we delete workspaces
        await queryRunner.query(`DELETE FROM d_b_workspace WHERE type = 'probe'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
