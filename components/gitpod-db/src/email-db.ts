/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { EMail } from '@gitpod/gitpod-protocol';
import { DeepPartial, Repository } from 'typeorm';
import { DBEmail } from './typeorm/entity/db-email';

export type PartialEMailUpdate = DeepPartial<EMail> & Pick<EMail, 'uid'>;

export const EMailDB = Symbol('EMailDB');
export interface EMailDB {
    scheduleEmail(newEmail: EMail): Promise<EMail>;
    updatePartial(partial: PartialEMailUpdate): Promise<void>;

    findEMailsToSend(limit: number): Promise<EMail[]>;
    findEMailsByCampaignAndUserId(campaignId: string, userId: string): Promise<EMail[]>;

    getEMailRepo(): Promise<Repository<DBEmail>>;
}
