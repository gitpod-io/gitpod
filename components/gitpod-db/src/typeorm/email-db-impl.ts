/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from 'inversify';
import { EMail } from '@gitpod/gitpod-protocol';
import { TypeORM } from '../typeorm/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { DBEmail } from './entity/db-email';
import { EMailDB, PartialEMailUpdate } from '../email-db';

@injectable()
export class TypeORMEMailDBImpl implements EMailDB {
  @inject(TypeORM) typeorm: TypeORM;

  protected async getManager(): Promise<EntityManager> {
    return (await this.typeorm.getConnection()).manager;
  }

  public async getEMailRepo(): Promise<Repository<DBEmail>> {
    const manager = await this.getManager();
    return manager.getRepository<DBEmail>(DBEmail);
  }

  async scheduleEmail(newEmail: EMail): Promise<EMail> {
    const repo = await this.getEMailRepo();
    return repo.save(newEmail);
  }

  async updatePartial(partial: PartialEMailUpdate): Promise<void> {
    const repo = await this.getEMailRepo();
    await repo.update(partial.uid, partial);
    return;
  }

  async findEMailsToSend(limit: number): Promise<EMail[]> {
    const repo = await this.getEMailRepo();
    const query = repo
      .createQueryBuilder('email')
      .where("email.scheduledSendgridTime = ''")
      .orderBy('email.scheduledInternalTime')
      .limit(limit);

    return await query.getMany();
  }

  async findEMailsByCampaignAndUserId(campaignId: string, userId: string): Promise<EMail[]> {
    const repo = await this.getEMailRepo();
    const qb = repo
      .createQueryBuilder('email')
      .where('email.campaignId = :campaignId', { campaignId })
      .andWhere('email.userId = :userId', { userId });
    return qb.getMany();
  }
}
