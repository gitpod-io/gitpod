/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamSubscription2 } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";

export const TeamSubscription2DB = Symbol("TeamSubscription2DB");
export interface TeamSubscription2DB {
    storeEntry(ts: TeamSubscription2): Promise<void>;
    findById(id: string): Promise<TeamSubscription2 | undefined>;
    findByPaymentRef(teamId: string, paymentReference: string): Promise<TeamSubscription2 | undefined>;
    findForTeam(teamId: string, date: string): Promise<TeamSubscription2 | undefined>;

    transaction<T>(code: (db: TeamSubscription2DB) => Promise<T>): Promise<T>;
}
