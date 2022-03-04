/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { tableExists } from "./helper/helper";

export class OAuthAuthCodeDB1620865190518 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_oauth_auth_code_entry` (`id` int NOT NULL AUTO_INCREMENT, `code` varchar(1024) NOT NULL, `redirectURI` varchar(1024) NOT NULL DEFAULT '', `codeChallenge` varchar(128) NOT NULL, `codeChallengeMethod` varchar(10) NOT NULL, `expiresAt` timestamp(6) NOT NULL, `userId` char(36) NOT NULL, `client` text NOT NULL, `scopes` text NOT NULL, PRIMARY KEY(`id`)) ENGINE=InnoDB;");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        if (await tableExists(queryRunner, "d_b_oauth_auth_code_entry")) {
            await queryRunner.query("DROP TABLE `d_b_oauth_auth_code_entry`");
        }
    }

}
