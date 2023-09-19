/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists, tableExists } from "./helper/helper";

export class AddOrgDefaultImageSetting1694775547603 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, "d_b_org_settings")) {
            if (!(await columnExists(queryRunner, "d_b_org_settings", "d_b_org_settings"))) {
                await queryRunner.query(
                    "ALTER TABLE `d_b_org_settings` ADD COLUMN `defaultWorkspaceImage` varchar(255) NULL",
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
