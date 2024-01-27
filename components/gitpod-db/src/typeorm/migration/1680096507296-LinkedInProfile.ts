/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { tableExists } from "./helper/helper";

const TABLE_NAME = "d_b_linked_in_profile";

export class LinkedInProfile1680096507296 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (id char(36) NOT NULL, userId char(36) NOT NULL, profile text NOT NULL, creationTime varchar(255) NOT NULL, _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, TABLE_NAME)) {
            await queryRunner.query(`DROP TABLE ${TABLE_NAME}`);
        }
    }
}
