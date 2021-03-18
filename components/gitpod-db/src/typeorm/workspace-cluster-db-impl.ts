/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

 import { Repository, EntityManager, DeepPartial } from "typeorm";
 import { injectable, inject } from "inversify";
 import { TypeORM } from "./typeorm";
import { WorkspaceClusterDB } from "../workspace-cluster-db";
import { DBWorkspaceCluster } from "./entity/db-workspace-cluster";
import { WorkspaceCluster, WorkspaceClusterState } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
 
 @injectable()
 export class WorkspaceClusterDBImpl implements WorkspaceClusterDB {
 
     @inject(TypeORM) typeORM: TypeORM;
 
     protected async getEntityManager(): Promise<EntityManager> {
         return (await this.typeORM.getConnection()).manager;
     }
 
     protected async getRepo(): Promise<Repository<DBWorkspaceCluster>> {
         return (await this.getEntityManager()).getRepository(DBWorkspaceCluster);
     }
 
     async save(cluster: WorkspaceCluster): Promise<void> {
         const repo = await this.getRepo();
         await repo.save(cluster);
     }
 
     async deleteByName(name: string): Promise<void> {
         const repo = await this.getRepo();
         await repo.deleteById(name);
     }
 
     async findByName(name: string): Promise<WorkspaceCluster | undefined> {
         const repo = await this.getRepo();
         return repo.findOneById(name);
     }

     async findFiltered(predicate: DeepPartial<{ state:WorkspaceClusterState, minScore: number, controller: string}>): Promise<WorkspaceCluster[]> {
        const repo = await this.getRepo();
        let qb = repo.createQueryBuilder("wsc")
            .where("TRUE = TRUE");  // make sure andWhere works
        if (predicate.state !== undefined) {
            qb.andWhere("wsc.state = :state", predicate);
        }
        if (predicate.minScore !== undefined) {
            qb.andWhere("wsc.score >= :minScore", predicate);
        }
        if (predicate.controller !== undefined) {
            qb.andWhere("wsc.controller >= :controller", predicate);
        }
        return qb.getMany();
     }
 }
 