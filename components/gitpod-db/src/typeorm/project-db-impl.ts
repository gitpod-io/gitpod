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
import { PartialProject, Project } from "@gitpod/gitpod-protocol";

@injectable()
export class ProjectDBImpl implements ProjectDB {
    @inject(TypeORM) typeORM: TypeORM;

    protected async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    async getRepo(): Promise<Repository<DBProject>> {
        return (await this.getEntityManager()).getRepository<DBProject>(DBProject);
    }

    public async findProjectById(projectId: string): Promise<Project | undefined> {
        const repo = await this.getRepo();
        return repo.findOne({ id: projectId, markedDeleted: false });
    }

    public async findProjectByCloneUrl(cloneUrl: string): Promise<Project | undefined> {
        const repo = await this.getRepo();
        return repo.findOne({ cloneUrl, markedDeleted: false });
    }

    public async findProjectsByCloneUrls(cloneUrls: string[]): Promise<(Project & { teamOwners?: string[] })[]> {
        if (cloneUrls.length === 0) {
            return [];
        }
        const repo = await this.getRepo();
        const q = repo.createQueryBuilder("project")
            .where("project.markedDeleted = false")
            .andWhere(`project.cloneUrl in (${ cloneUrls.map(u => `'${u}'`).join(", ") })`)
        const projects = await q.getMany();

        const teamIds = Array.from(new Set(projects.map(p => p.teamId).filter(id => !!id)));

        const teamIdsAndOwners = teamIds.length === 0 ? [] : (await (await this.getEntityManager()).query(`
                SELECT member.teamId AS teamId, user.name AS owner FROM d_b_user AS user
                    LEFT JOIN d_b_team_membership AS member ON (user.id = member.userId)
                    WHERE member.teamId IN (${teamIds.map(id => `'${id}'`).join(", ")})
                    AND member.deleted = 0
                    AND member.role = 'owner'
            `)) as { teamId: string, owner: string }[];

        const result: (Project & { teamOwners?: string[] })[] = [];
        for (const project of projects) {
            result.push({...project, teamOwners: teamIdsAndOwners.filter(i => i.teamId === project.teamId).map(i => i.owner)});
        }

        return result;
    }

    public async findTeamProjects(teamId: string): Promise<Project[]> {
        const repo = await this.getRepo();
        return repo.find({ teamId, markedDeleted: false });
    }

    public async findUserProjects(userId: string): Promise<Project[]> {
        const repo = await this.getRepo();
        return repo.find({ userId, markedDeleted: false });
    }

    public async storeProject(project: Project): Promise<Project> {
        const repo = await this.getRepo();
        return repo.save(project);
    }

    public async updateProject(partialProject: PartialProject): Promise<void> {
        const repo = await this.getRepo();
        const count = await repo.count({ id: partialProject.id, markedDeleted: false });
        if (count < 1) {
            throw new Error('A project with this ID could not be found');
        }
        await repo.update(partialProject.id, partialProject);
    }

    public async markDeleted(projectId: string): Promise<void> {
        const repo = await this.getRepo();
        const project = await repo.findOne({ id: projectId });
        if (project) {
            project.markedDeleted = true;
            await repo.save(project);
        }
    }
}
