/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { indexExists } from "./helper/helper";

export const TABLE_NAME = "d_b_workspace";
export const INDEX_NAME = "ind_id_deleted";
export const FIELDS = ["id", "deleted"];

export class IndexWorkspaceIdDeleted1647333804782 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await indexExists(queryRunner, TABLE_NAME, INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${INDEX_NAME} ON ${TABLE_NAME} (${FIELDS.join(", ")})`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
