/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const TABLE_NAME = "d_b_personal_access_token";
const COLUMN_NAME = "description";

export class PersonalAccessTokenRemoveDescriptionColumn1669237520073 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, TABLE_NAME, COLUMN_NAME)) {
            await queryRunner.query(`ALTER TABLE ${TABLE_NAME} DROP COLUMN ${COLUMN_NAME}`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
