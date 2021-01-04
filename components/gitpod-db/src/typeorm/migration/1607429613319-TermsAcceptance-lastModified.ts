/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { tableExists, columnExists } from "./helper/helper";

export class Foo1607429613319 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        if (await tableExists(queryRunner, "d_b_terms_acceptance_entry")) {
            if (!(await columnExists(queryRunner, "d_b_terms_acceptance_entry", "_lastModified"))) {
                await queryRunner.query("ALTER TABLE d_b_terms_acceptance_entry ADD COLUMN _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}
