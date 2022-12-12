/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { tableExists } from "./helper/helper";

export class CreateOIDCClientConfigTable1670850042413 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, "d_b_oidc_client_config"))) {
            await queryRunner.query(
                "CREATE TABLE IF NOT EXISTS `d_b_oidc_client_config` (`id` varchar(255) NOT NULL, `issuer` varchar(255) NOT NULL, `data` text(65535) NOT NULL, `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), `deleted` tinyint(4) NOT NULL DEFAULT '0', PRIMARY KEY (id))",
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, "d_b_oidc_client_config")) {
            await queryRunner.query("DROP TABLE `d_b_oidc_client_config`");
        }
    }
}
