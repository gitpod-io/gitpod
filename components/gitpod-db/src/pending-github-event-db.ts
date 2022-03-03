/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PendingGithubEvent, User, Identity } from '@gitpod/gitpod-protocol';
import { EntityManager } from 'typeorm';

export type PendingGithubEventWithUser = PendingGithubEvent & { identity: Identity & { user: User } };

export const TransactionalPendingGithubEventDBFactory = Symbol('TransactionalPendingGithubEventDBFactory');
export interface TransactionalPendingGithubEventDBFactory {
    (manager: EntityManager): PendingGithubEventDB;
}

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

    transaction<T>(code: (db: PendingGithubEventDB) => Promise<T>): Promise<T>;
}
