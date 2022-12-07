/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { tableExists } from "./helper/helper";

export class CreatePersonalAccessTokenTable1668531007092 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, "d_b_personal_access_token"))) {
            await queryRunner.query(
                "CREATE TABLE IF NOT EXISTS `d_b_personal_access_token` (`id` varchar(255) NOT NULL, `userId` varchar(255) NOT NULL, `hash` varchar(255) NOT NULL, `name` varchar(255) NOT NULL, `description` text DEFAULT NULL, `scopes` text NOT NULL, `expirationTime` timestamp(6) NOT NULL, `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `deleted` tinyint(4) NOT NULL DEFAULT '0', PRIMARY KEY (id))",
            );
            await queryRunner.query("CREATE INDEX `ind_userId` ON `d_b_personal_access_token` (userId)");
            await queryRunner.query("CREATE INDEX `ind_hash` ON `d_b_personal_access_token` (hash)");
            await queryRunner.query("CREATE INDEX `ind_lastModified` ON `d_b_personal_access_token` (_lastModified)");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, "d_b_personal_access_token")) {
            await queryRunner.query("DROP TABLE `d_b_personal_access_token`");
        }
    }
}
