/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class AppInstallation1544546800783 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE `d_b_app_installation` (`platform` varchar(255) NOT NULL, `installationID` varchar(255) NOT NULL, `ownerUserID` char(36), `platformUserID` varchar(255), `state` char(36) NOT NULL, `creationTime` timestamp(6) NOT NULL, `lastUpdateTime` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY(`platform`, `installationID`, `state`)) ENGINE=InnoDB");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE `d_b_app_installation`");
    }

}
