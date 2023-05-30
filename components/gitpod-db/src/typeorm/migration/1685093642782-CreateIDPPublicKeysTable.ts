/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { tableExists } from "./helper/helper";

export class CreateIDPPublicKeysTable1685093642782 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, "d_b_idp_public_keys"))) {
            await queryRunner.query(
                "CREATE TABLE IF NOT EXISTS `d_b_idp_public_keys` (`kid` varchar(255) NOT NULL, `last_active_time` timestamp(6) NOT NULL, `data` text(65535) NOT NULL, `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), `deleted` tinyint(4) NOT NULL DEFAULT '0', PRIMARY KEY (kid))",
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, "d_b_idp_public_keys")) {
            await queryRunner.query("DROP TABLE `d_b_idp_public_keys`");
        }
    }
}
