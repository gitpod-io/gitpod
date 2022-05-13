/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists, indexExists } from "./helper/helper";

export class CloneUrlIndexed1652365883273 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const TABLE_NAME = "d_b_workspace";
        const COLUMN_NAME = "cloneURL";
        const TYPE_INDEX_NAME = "d_b_workspace_cloneURL_idx";

        if (!(await columnExists(queryRunner, TABLE_NAME, COLUMN_NAME))) {
            await queryRunner.query(
                `ALTER TABLE
                    ${TABLE_NAME}
                ADD COLUMN
                    ${COLUMN_NAME} VARCHAR(256)
                GENERATED ALWAYS AS (
                    context ->> "$.repository.cloneUrl"
                )`,
            );
        }
        if (!(await indexExists(queryRunner, TABLE_NAME, TYPE_INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${TYPE_INDEX_NAME} ON ${TABLE_NAME} (${COLUMN_NAME})`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
