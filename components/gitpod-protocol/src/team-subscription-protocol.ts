/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Without } from "./util/without";
import uuidv4 = require("uuid/v4");
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
}

export namespace TeamSubscription {
    export const create = (ts: Without<TeamSubscription, 'id'>): TeamSubscription => {
        const withId = ts as TeamSubscription;
        withId.id = uuidv4();
        return withId;
    }
    export const isActive = (ts: TeamSubscription, date: string): boolean => {
        return ts.startDate <= date && (ts.endDate === undefined || date < ts.endDate);
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
export type TeamSubscriptionSlotDeactivated = TeamSubscriptionSlot & { assigneeId: string, assigneeIdentifier: AssigneeIdentifier };
export type TeamSubscriptionSlotAssigned = TeamSubscriptionSlot & TeamSubscriptionSlotDeactivated & { subscriptionId: string };

export type TeamSubscriptionSlotState = 'unassigned' | 'assigned' | 'deactivated' | 'cancelled';

export namespace TeamSubscriptionSlot {
    export const create = (ts: Without<TeamSubscriptionSlot, 'id'>): TeamSubscriptionSlot => {
        const withId = ts as TeamSubscriptionSlot;
        withId.id = uuidv4();
        return withId;
    }
    export const assign = (slot: TeamSubscriptionSlot, assigneeId: string, subscriptionId: string, assigneeIdentifier: AssigneeIdentifier) => {
        slot.assigneeId = assigneeId;
        slot.subscriptionId = subscriptionId;
        slot.assigneeIdentifier = assigneeIdentifier;
    }
    export const deactivate = (slot: TeamSubscriptionSlot, cancellationDate: string) => {
        slot.subscriptionId = undefined;
        slot.cancellationDate = cancellationDate;
    }
    export const reactivate = (slot: TeamSubscriptionSlot, subscriptionId?: string) => {
        slot.subscriptionId = subscriptionId;
        slot.cancellationDate = undefined;
    }
    export const status = (slot: TeamSubscriptionSlot, now: string): TeamSubscriptionSlotState => {
        if (slot.cancellationDate) {
            if (slot.cancellationDate < now) {
                return 'cancelled';
            } else {
                return 'deactivated';
            }
        } else {
            if (slot.subscriptionId) {
                return 'assigned';
            } else {
                return 'unassigned';
            }
        }

    }
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
        authHost: string,
        authName: string
    }
}
