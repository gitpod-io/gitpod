/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PendingGithubEvent, User, Identity } from "@gitpod/gitpod-protocol";

export type PendingGithubEventWithUser = PendingGithubEvent & { identity: Identity & { user: User } };

export const PendingGithubEventDB = Symbol('PendingGithubEventDB');
export interface PendingGithubEventDB {
    store(evt: PendingGithubEvent): Promise<void>;
    findByGithubUserID(type: string, accountId: number): Promise<PendingGithubEvent[]>;
    delete(evt: PendingGithubEvent): Promise<void>;

    /**
     * GitHub events are typically pending because we didn't have a corrsponding user in the system
     * when the event arrived. This function finds all pending events for which a user exists now.
     */
    findWithUser(type: string): Promise<PendingGithubEventWithUser[]>;
}