/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from 'inversify';
import { WorkspaceInstance } from '@gitpod/gitpod-protocol';
import { AccountStatement } from '@gitpod/gitpod-protocol/lib/accounting-protocol';
import { AccountService } from '@gitpod/gitpod-payment-endpoint/lib/accounting';

export type CachedAccountStatement = Pick<AccountStatement, 'remainingHours' | 'endDate'>;

/**
 * This represents shared functionality and _state_ between GitpodServerImplIO and EiligibilityServiceIO
 * around AccountStatements
 */
@injectable()
export class AccountStatementProvider {
  @inject(AccountService) protected readonly accountService: AccountService;

  protected cachedStatement: CachedAccountStatement | undefined;

  setCachedStatement(cachedStatement: CachedAccountStatement) {
    this.cachedStatement = cachedStatement;
  }

  getCachedStatement(): CachedAccountStatement | undefined {
    return this.cachedStatement;
  }

  async getAccountStatement(userId: string, date: string): Promise<AccountStatement> {
    const statement = await this.accountService.getAccountStatement(userId, date);
    // Fill cache
    this.setCachedStatement({
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
