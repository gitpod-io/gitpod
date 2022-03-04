/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { TeamSubscription, TeamSubscriptionSlot } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";
import { DeepPartial } from "typeorm";

export const TeamSubscriptionDB = Symbol('TeamSubscriptionDB');
export interface TeamSubscriptionDB {
    storeTeamSubscriptionEntry(ts: TeamSubscription): Promise<void>;
    findTeamSubscriptionById(id: string): Promise<TeamSubscription | undefined>;
    findTeamSubscriptionByPaymentRef(userId: string, paymentReference: string): Promise<TeamSubscription | undefined>;
    findTeamSubscriptionsForUser(userId: string, date: string): Promise<TeamSubscription[]>;
    findTeamSubscriptions(partial: DeepPartial<TeamSubscription>): Promise<TeamSubscription[]>;

    storeSlot(slot: TeamSubscriptionSlot): Promise<TeamSubscriptionSlot>;
    findSlotById(id: string): Promise<TeamSubscriptionSlot | undefined>;
    findSlotsByTeamSubscriptionId(teamSubscriptionId: string): Promise<TeamSubscriptionSlot[]>;
    findSlotsByAssignee(assigneeId: string): Promise<TeamSubscriptionSlot[]>;

    transaction<T>(code: (db: TeamSubscriptionDB) => Promise<T>): Promise<T>;
}