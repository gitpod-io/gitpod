/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AccountStatement } from "@gitpod/gitpod-protocol/lib/accounting-protocol";

export const AccountService = Symbol('AccountService');
export interface AccountService {
    getAccountStatement(userId: string, endDate: string): Promise<AccountStatement>;
    getRemainingUsageHours(statement: AccountStatement, numInstances: number, considerNextPeriod?: boolean): number;
}
