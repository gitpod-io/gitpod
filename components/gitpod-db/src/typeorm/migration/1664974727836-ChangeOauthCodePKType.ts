/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeOauthCodePKType1664974727836 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Change the type of the primary key field.
        // Some (old) rows in the table have integer keys; new values will have uids.
        await queryRunner.query(`ALTER TABLE d_b_oauth_auth_code_entry CHANGE id id char(36);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
