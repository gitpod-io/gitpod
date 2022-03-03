/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Chargebee as chargebee } from './chargebee-types';

export function getStartDate(chargebeeSubscription: chargebee.Subscription): string {
    const chargebeeStart = chargebeeSubscription.started_at || chargebeeSubscription.start_date;
    if (!chargebeeStart) {
        throw new Error(
            'subscription.started_at or subscription.start_date must be set on subscription created event.',
        );
    } else {
        return chargeBeTimestampToDate(chargebeeStart);
    }
}

export function getCancelledAt(chargebeeSubscription: chargebee.Subscription): string {
    if (!chargebeeSubscription.cancelled_at) {
        throw new Error('subscription.cancelled_at must be set on subscription cancellation changed event.');
    } else {
        return chargeBeTimestampToDate(chargebeeSubscription.cancelled_at);
    }
}

export function getCurrentTermEnd(chargebeeSubscription: chargebee.Subscription): string {
    if (!chargebeeSubscription.current_term_end) {
        throw new Error('subscription.current_term_end must be set.');
    } else {
        return chargeBeTimestampToDate(chargebeeSubscription.current_term_end);
    }
}

export function getUpdatedAt(chargebeeSubscription: chargebee.Subscription): string {
    return chargeBeTimestampToDate(chargebeeSubscription.updated_at);
}

/**
 * Chargebee times are in *seconds* since epoch start
 */
function chargeBeTimestampToDate(cbTime: number): string {
    return new Date(cbTime * 1000).toISOString();
}
