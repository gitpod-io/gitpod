/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { TypeORM } from "./typeorm";
import { Repository } from "typeorm";
import { ProjectDB } from "../project-db";
import { DBProject } from "./entity/db-project";
import { Project } from "@gitpod/gitpod-protocol";
import * as uuidv4 from 'uuid/v4';

@injectable()
export class ProjectDBImpl implements ProjectDB {
    @inject(TypeORM) typeORM: TypeORM;

    protected async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    async getRepo(): Promise<Repository<DBProject>> {
        return (await this.getEntityManager()).getRepository<DBProject>(DBProject);
    }

    public async findProjectsByTeam(teamId: string): Promise<Project[]> {
        const repo = await this.getRepo();
        return repo.find({ teamId });
    }

    public async createProject(name: string, cloneUrl: string, teamId: string, appInstallationId: string): Promise<Project> {
        const repo = await this.getRepo();

        const project: Project = {
            id: uuidv4(),
            name,
            teamId,
            cloneUrl,
            appInstallationId,
            creationTime: new Date().toISOString(),
        }
        await repo.save(project);
        return project;
    }
}
