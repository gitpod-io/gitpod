/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AccountingDB } from "@gitpod/gitpod-db/lib/accounting-db";
import { Period } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { inject, injectable } from "inversify";
import { AccountService } from "./account-service";

@injectable()
export class AccountingServer {

    @inject(AccountingDB) accountingDB: AccountingDB;
    @inject(AccountService) accountingService: AccountService;

    async closeSubscriptionPeriods(period: Period) {
        const subscriptions = await this.accountingDB.findActiveSubscriptions(period.startDate, period.endDate);
        for(let subscription of subscriptions) {
            await this.accountingService.getAccountStatement(subscription.userId, period.endDate)
        }
    }
}
