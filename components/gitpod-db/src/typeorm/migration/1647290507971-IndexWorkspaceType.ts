/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { indexExists } from "./helper/helper";

export class IndexWorkspaceType1647290507971 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const TABLE_NAME = "d_b_workspace";
        const TYPE_INDEX_NAME = "ind_type";
        if (!(await indexExists(queryRunner, TABLE_NAME, TYPE_INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${TYPE_INDEX_NAME} ON ${TABLE_NAME} (type)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
