/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class ExpandScopes1600693766152 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE d_b_gitpod_token MODIFY COLUMN scopes text");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}
