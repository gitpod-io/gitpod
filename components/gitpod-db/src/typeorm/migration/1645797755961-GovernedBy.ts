/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

export class GovernedBy1645797755961 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!process.env.INSTALLATION_SHORTNAME) {
            throw new Error("Migration requires `INSTALLATION_SHORTNAME` to be set!");
        }

        const TABLE_NAME = "d_b_workspace_cluster";
        const COLUMN_NAME = "governedBy";

        if (!(await columnExists(queryRunner, TABLE_NAME, COLUMN_NAME))) {
            await queryRunner.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN ${COLUMN_NAME} varchar(255) NOT NULL DEFAULT ''`);
        }

        await queryRunner.query(`UPDATE TABLE ${TABLE_NAME} SET governedBy = '${process.env.INSTALLATION_SHORTNAME}' WHERE govern = TRUE`);
        await queryRunner.query(`ALTER TABLE ${TABLE_NAME} DROP PRIMARY KEY, ADD PRIMARY KEY(name, ${COLUMN_NAME})`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }
}
