/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class IdentityTokensToEmails1624290876856 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.renameColumn("d_b_identity", "tokens", "additionalEmails");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.renameColumn("d_b_identity", "additionalEmails", "tokens");
    }
}
