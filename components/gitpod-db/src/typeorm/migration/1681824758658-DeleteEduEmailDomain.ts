/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class DeleteEduEmailDomain1681824758658 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP TABLE IF EXISTS `d_b_edu_email_domain`");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS d_b_edu_email_domain (  domain varchar(255) NOT NULL,  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (domain),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        );
    }
}
