/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from "inversify";
import { EntityManager, Repository, DeepPartial } from "typeorm";

import { TeamSubscription, TeamSubscriptionSlot } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";

import { TeamSubscriptionDB } from "../team-subscription-db";
import { DBTeamSubscription } from "./entity/db-team-subscription";
import { DBTeamSubscriptionSlot } from "./entity/db-team-subscription-slot";
import { TypeORM } from "./typeorm";

@injectable()
export class TeamSubscriptionDBImpl implements TeamSubscriptionDB {
    @inject(TypeORM) protected readonly typeORM: TypeORM;

    async transaction<T>(code: (db: TeamSubscriptionDB) => Promise<T>): Promise<T> {
        const manager = await this.getEntityManager();
        return await manager.transaction(async manager => {
            return await code(new TransactionalTeamSubscriptionDBImpl(manager));
        });
    }

    protected async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getRepo(): Promise<Repository<DBTeamSubscription>> {
        return (await this.getEntityManager()).getRepository(DBTeamSubscription);
    }

    protected async getSlotsRepo(): Promise<Repository<DBTeamSubscriptionSlot>> {
        return (await this.getEntityManager()).getRepository(DBTeamSubscriptionSlot);
    }

    /**
     * Team Subscriptions
     */

    async storeTeamSubscriptionEntry(ts: TeamSubscription): Promise<void> {
        const repo = await this.getRepo();
        await repo.save(ts);
    }

    async findTeamSubscriptionById(id: string): Promise<TeamSubscription | undefined> {
        const repo = await this.getRepo();
        return repo.findOne(id);
    }

    async findTeamSubscriptionByPaymentRef(userId: string, paymentReference: string): Promise<TeamSubscription | undefined> {
        const repo = await this.getRepo();
        return repo.findOne({ userId, paymentReference });
    }

    async findTeamSubscriptionsForUser(userId: string, date: string): Promise<TeamSubscription[]> {
        const repo = await this.getRepo();
        const query = repo.createQueryBuilder('ts')
            .where('ts.userId = :userId', { userId: userId })
            .andWhere('ts.startDate <= :date', { date: date })
            .andWhere('ts.endDate = "" OR ts.endDate > :date', { date: date });
        return query.getMany();
    }

    async findTeamSubscriptions(partial: DeepPartial<TeamSubscription>): Promise<TeamSubscription[]> {
        const repo = await this.getRepo();
        return repo.find(partial);
    }

    /**
     * Team Subscription Slots
     */
    async storeSlot(slot: TeamSubscriptionSlot): Promise<TeamSubscriptionSlot> {
        const dbSlot = { ...slot };
        for (const k of Object.keys(dbSlot)) {
            const v = (dbSlot as any)[k];
            if (k in dbSlot && v === undefined) {
                // typeorm ignores undefined as 'no data set' but we want to override old values!
                (dbSlot as any)[k] = '';
            }
        }
        return (await this.getSlotsRepo()).save(dbSlot);
    }

    async findSlotById(id: string): Promise<TeamSubscriptionSlot | undefined> {
        const repo = await this.getSlotsRepo();
        return repo.findOne(id);
    }

    async findSlotsByTeamSubscriptionId(teamSubscriptionId: string): Promise<TeamSubscriptionSlot[]> {
        const repo = await this.getSlotsRepo();
        return repo.find({ teamSubscriptionId });
    }

    async findSlotsByAssignee(assigneeId: string): Promise<TeamSubscriptionSlot[]> {
        const repo = await this.getSlotsRepo();
        return repo.find({ assigneeId });
    }
}

export class TransactionalTeamSubscriptionDBImpl extends TeamSubscriptionDBImpl {
    constructor(protected readonly manager: EntityManager) {
        super();
    }

    async getEntityManager(): Promise<EntityManager> {
        return this.manager;
    }
}