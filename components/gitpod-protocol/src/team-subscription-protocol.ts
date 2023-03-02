/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v4 as uuidv4 } from "uuid";
import { Subscription } from "./accounting-protocol";

export interface TeamSubscription {
    id: string;
    userId: string;
    planId: string;
    startDate: string;
    endDate?: string;
    quantity: number;
    /** The Chargebee subscription id */
    paymentReference: string;
    cancellationDate?: string;
    deleted?: boolean;
    /** If this flag is set slots are not eligibile for clusters with "more-resources" - even if their plan might be */
    excludeFromMoreResources: boolean;
}

export namespace TeamSubscription {
    export const create = (ts: Omit<TeamSubscription, "id">): TeamSubscription => {
        const withId = ts as TeamSubscription;
        withId.id = uuidv4();
        return withId;
    };
    export const isActive = (ts: TeamSubscription, date: string): boolean => {
        return ts.startDate <= date && (ts.endDate === undefined || date < ts.endDate);
    };
    export function isCancelled(s: TeamSubscription, date: string): boolean {
        return (!!s.cancellationDate && s.cancellationDate < date) || (!!s.endDate && s.endDate < date); // This edge case is meant to handle bad data: If for whatever reason cancellationDate has not been set: treat endDate as such
    }
}

export interface TeamSubscription2 {
    id: string;
    teamId: string;
    planId: string;
    startDate: string;
    endDate?: string;
    quantity: number;
    /** The Chargebee subscription id */
    paymentReference: string;
    cancellationDate?: string;
    excludeFromMoreResources: boolean;
}

export namespace TeamSubscription2 {
    export const create = (ts2: Omit<TeamSubscription2, "id">): TeamSubscription2 => {
        const withId = ts2 as TeamSubscription2;
        withId.id = uuidv4();
        return withId;
    };
    export const isActive = (ts2: TeamSubscription2, date: string): boolean => {
        return ts2.startDate <= date && (ts2.endDate === undefined || date < ts2.endDate);
    };
    export function isCancelled(s: TeamSubscription2, date: string): boolean {
        return (!!s.cancellationDate && s.cancellationDate < date) || (!!s.endDate && s.endDate < date); // This edge case is meant to handle bad data: If for whatever reason cancellationDate has not been set: treat endDate as such
    }
}

/**
 * A slot represents one unit of a TeamSubscription that gets assigned to one user at a time
 */
export interface TeamSubscriptionSlot {
    id: string;
    teamSubscriptionId: string;
    assigneeId?: string;
    assigneeIdentifier?: AssigneeIdentifier;
    subscriptionId?: string;
    cancellationDate?: string;
}
export type TeamSubscriptionSlotDeactivated = TeamSubscriptionSlot & {
    assigneeId: string;
    assigneeIdentifier: AssigneeIdentifier;
};
export type TeamSubscriptionSlotAssigned = TeamSubscriptionSlot &
    TeamSubscriptionSlotDeactivated & { subscriptionId: string };

export type TeamSubscriptionSlotState = "unassigned" | "assigned" | "deactivated" | "cancelled";

export namespace TeamSubscriptionSlot {
    export const create = (ts: Omit<TeamSubscriptionSlot, "id">): TeamSubscriptionSlot => {
        const withId = ts as TeamSubscriptionSlot;
        withId.id = uuidv4();
        return withId;
    };
    export const assign = (
        slot: TeamSubscriptionSlot,
        assigneeId: string,
        subscriptionId: string,
        assigneeIdentifier: AssigneeIdentifier,
    ) => {
        slot.assigneeId = assigneeId;
        slot.subscriptionId = subscriptionId;
        slot.assigneeIdentifier = assigneeIdentifier;
    };
    export const deactivate = (slot: TeamSubscriptionSlot, cancellationDate: string) => {
        slot.subscriptionId = undefined;
        slot.cancellationDate = cancellationDate;
    };
    export const reactivate = (slot: TeamSubscriptionSlot, subscriptionId?: string) => {
        slot.subscriptionId = subscriptionId;
        slot.cancellationDate = undefined;
    };
    export const status = (slot: TeamSubscriptionSlot, now: string): TeamSubscriptionSlotState => {
        if (slot.cancellationDate) {
            if (slot.cancellationDate < now) {
                return "cancelled";
            } else {
                return "deactivated";
            }
        } else {
            if (slot.subscriptionId) {
                return "assigned";
            } else {
                return "unassigned";
            }
        }
    };
    export const isActive = (slot: TeamSubscriptionSlot): boolean => {
        return !slot.cancellationDate;
    };
}

/**
 * The mapping between a TeamSubscription and a resulting Subscription, resolved
 */
export interface TeamSubscriptionSlotResolved {
    id: string;
    teamSubscription: TeamSubscription;
    state: TeamSubscriptionSlotState;
    assigneeId?: string;
    assigneeIdentifier?: AssigneeIdentifier;
    subscription?: Subscription;
    cancellationDate?: string;
    hoursLeft?: number;
}

/**
 * Contains the data structure that the assigner used to identify the assignee.
 */
export type AssigneeIdentifier = AssigneeIdentityIdentifier;
export interface AssigneeIdentityIdentifier {
    identity: {
        authHost: string;
        authName: string;
    };
}
