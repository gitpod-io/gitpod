/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Team, User } from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { GarbageCollectedCache } from "@gitpod/gitpod-protocol/lib/util/garbage-collected-cache";
import { BillingModes } from "./billing-mode";

/**
 * Calculating BillingMode over and over again can be expensive. On the other hand, we want to be able to update it fast enough, because if it flips, the user is waiting for it.
 * Adding this cache - with this configuration - is an attempt to find a sweet spot in between.
 */
export class CachedBillingModes implements BillingModes {
    protected readonly cache = new GarbageCollectedCache<BillingMode>(10, 5 * 60);

    constructor(protected readonly impl: BillingModes) {}

    async getBillingMode(attributionId: AttributionId, now: Date): Promise<BillingMode> {
        const cached = this.cache.get(AttributionId.render(attributionId));
        if (cached) {
            return cached;
        }
        return this.impl.getBillingMode(attributionId, now);
    }

    async getBillingModeForUser(user: User, now: Date): Promise<BillingMode> {
        const cached = this.cache.get(AttributionId.render({ kind: "user", userId: user.id }));
        if (cached) {
            return cached;
        }
        return this.impl.getBillingModeForUser(user, now);
    }

    async getBillingModeForTeam(team: Team, now: Date): Promise<BillingMode> {
        const cached = this.cache.get(AttributionId.render({ kind: "team", teamId: team.id }));
        if (cached) {
            return cached;
        }
        return this.impl.getBillingModeForTeam(team, now);
    }
}
