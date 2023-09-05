/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

export class WorkspaceInstanceControllerId1693552328801 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, "d_b_workspace_instance", "controllerId"))) {
            await queryRunner.query(
                "ALTER TABLE d_b_workspace_instance ADD COLUMN `controllerId` varchar(255) NOT NULL DEFAULT ''",
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, "d_b_workspace_instance", "controllerId")) {
            await queryRunner.query("ALTER TABLE d_b_workspace_instance DROP COLUMN `controllerId`");
        }
    }
}
