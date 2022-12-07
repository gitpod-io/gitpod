/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class UserSshPublicKey1654842204415 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "CREATE TABLE IF NOT EXISTS `d_b_user_ssh_public_key` ( `id` char(36) NOT NULL, `userId` char(36) NOT NULL, `name` varchar(255) NOT NULL, `key` text NOT NULL, `fingerprint` varchar(255) NOT NULL, `deleted` tinyint(4) NOT NULL DEFAULT '0', `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), `creationTime` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `lastUsedTime` varchar(255) NOT NULL DEFAULT '', PRIMARY KEY (`id`), KEY ind_userId (`userId`), KEY ind_creationTime (`creationTime`) ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;",
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
