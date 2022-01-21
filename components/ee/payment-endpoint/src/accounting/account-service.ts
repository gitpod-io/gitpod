/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { AccountStatement } from '@gitpod/gitpod-protocol/lib/accounting-protocol';

export const AccountService = Symbol('AccountService');
export interface AccountService {
  getAccountStatement(userId: string, endDate: string): Promise<AccountStatement>;
  getRemainingUsageHours(statement: AccountStatement, numInstances: number, considerNextPeriod?: boolean): number;
}
