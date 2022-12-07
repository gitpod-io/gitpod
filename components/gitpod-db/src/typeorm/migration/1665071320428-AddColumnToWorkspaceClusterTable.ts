/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddColumnToWorkspaceClusterTable1665071320428 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const installationShortname = process.env.GITPOD_INSTALLATION_SHORTNAME ?? "";

        await queryRunner.query(
            `ALTER TABLE d_b_workspace_cluster ADD COLUMN applicationCluster varchar(60) NOT NULL DEFAULT ''`,
        );

        await queryRunner.query(`UPDATE d_b_workspace_cluster SET applicationCluster = '${installationShortname}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
