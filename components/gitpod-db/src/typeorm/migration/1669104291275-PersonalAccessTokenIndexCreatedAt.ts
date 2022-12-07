/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { indexExists } from "./helper/helper";

const table = "d_b_personal_access_token";
const col = "createdAt";
const indexName = "idx_createdAt";

export class PersonalAccessTokenIndexCreationTime1669104291275 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await indexExists(queryRunner, table, indexName))) {
            await queryRunner.query(`CREATE INDEX \`${indexName}\` ON \`${table}\` (${col})`);
        }
    }
    public async down(queryRunner: QueryRunner): Promise<void> {}
}
