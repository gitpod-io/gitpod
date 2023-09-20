/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWebhookInstallation1695201864588 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
                CREATE TABLE IF NOT EXISTS d_b_webhook_installation
                    ( id char(36) NOT NULL, projectId char(36) NOT NULL, installerUserId char(36) NOT NULL, _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (id), UNIQUE INDEX (projectId))
                ENGINE=InnoDB
            `,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
