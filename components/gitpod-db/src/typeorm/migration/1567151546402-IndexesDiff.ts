/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class Diff1567151546402 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        // Diff between @Index() annotations and DB
        await queryRunner.query("CREATE INDEX `ind_originalWorkspaceId` ON `d_b_snapshot`(`originalWorkspaceId`)");
        await queryRunner.query("CREATE INDEX `ind_user_paymentReference` ON `d_b_subscription`(`userId`, `paymentReference`)");
        await queryRunner.query("CREATE INDEX `ind_tsid` ON `d_b_team_subscription_slot`(`teamSubscriptionId`)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        // This does not make much sense here
    }

}
