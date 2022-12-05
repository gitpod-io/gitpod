/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { AccountStatement } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { AccountService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { GarbageCollectedCache } from "@gitpod/gitpod-protocol/lib/util/garbage-collected-cache";

export type CachedAccountStatement = Pick<AccountStatement, "remainingHours" | "endDate">;

/**
 * This represents shared functionality and _state_ between GitpodServerImplIO and EiligibilityServiceIO
 * around AccountStatements
 */
@injectable()
export class AccountStatementProvider {
    @inject(AccountService) protected readonly accountService: AccountService;

    /**
     * AccountStatements, cached by userId
     */
    protected readonly cachedStatements = new GarbageCollectedCache<CachedAccountStatement>(5 * 60, 10 * 60);

    getCachedStatement(userId: string): CachedAccountStatement | undefined {
        return this.cachedStatements.get(userId);
    }

    async getAccountStatement(userId: string, date: string): Promise<AccountStatement> {
        const statement = await this.accountService.getAccountStatement(userId, date);
        this.cachedStatements.set(userId, {
            remainingHours: statement.remainingHours,
            endDate: statement.endDate,
        });
        return statement;
    }

    async getRemainingUsageHours(userId: string, date: string, runningInstancesPromise: Promise<WorkspaceInstance[]>) {
        const statement = await this.getAccountStatement(userId, date);
        const runningInstancesCount = Math.max(1, (await runningInstancesPromise).length);
        return this.accountService.getRemainingUsageHours(statement, runningInstancesCount);
    }
}
