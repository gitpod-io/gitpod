/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { columnExists } from "./helper/helper";

export class AddSlugToProject1634894637934 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        if (!(await columnExists(queryRunner, "d_b_project", "slug"))) {
            await queryRunner.query("ALTER TABLE d_b_project ADD COLUMN `slug` varchar(255) NULL");
        }
        if (await columnExists(queryRunner, "d_b_project", "slug")) {
            await queryRunner.query("UPDATE d_b_project SET slug = name WHERE cloneUrl LIKE '%github%' AND slug IS NULL;");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}
