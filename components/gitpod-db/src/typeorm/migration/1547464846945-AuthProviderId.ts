/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class AuthProviderId1547464846945 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("UPDATE `d_b_identity` SET authProviderId = IF ( authProviderId = 'github.com', 'Public-GitHub', '' )");
        await queryRunner.query("DELETE FROM `d_b_identity` WHERE authProviderId = ''");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("UPDATE `d_b_identity` SET authProviderId = IF ( authProviderId = 'Public-GitHub', 'github.com', '' )");
        await queryRunner.query("DELETE FROM `d_b_identity` WHERE authProviderId = ''");
    }

}
