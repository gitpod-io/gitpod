/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from 'inversify';
import { TypeORM } from './typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PartialProject, Project, ProjectEnvVar, ProjectEnvVarWithValue } from '@gitpod/gitpod-protocol';
import { EncryptionService } from '@gitpod/gitpod-protocol/lib/encryption/encryption-service';
import { ProjectDB } from '../project-db';
import { DBProject } from './entity/db-project';
import { DBProjectEnvVar } from './entity/db-project-env-vars';
import { DBProjectInfo } from './entity/db-project-info';

function toProjectEnvVar(envVarWithValue: ProjectEnvVarWithValue): ProjectEnvVar {
    const envVar = { ...envVarWithValue };
    delete (envVar as any)['value'];
    return envVar;
}

@injectable()
export class ProjectDBImpl implements ProjectDB {
    @inject(TypeORM) typeORM: TypeORM;
    @inject(EncryptionService) protected readonly encryptionService: EncryptionService;

    protected async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getRepo(): Promise<Repository<DBProject>> {
        return (await this.getEntityManager()).getRepository<DBProject>(DBProject);
    }

    protected async getProjectEnvVarRepo(): Promise<Repository<DBProjectEnvVar>> {
        return (await this.getEntityManager()).getRepository<DBProjectEnvVar>(DBProjectEnvVar);
    }

    protected async getProjectInfoRepo(): Promise<Repository<DBProjectInfo>> {
        return (await this.getEntityManager()).getRepository<DBProjectInfo>(DBProjectInfo);
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
        const q = repo
            .createQueryBuilder('project')
            .where('project.markedDeleted = false')
            .andWhere(`project.cloneUrl in (${cloneUrls.map((u) => `'${u}'`).join(', ')})`);
        const projects = await q.getMany();

        const teamIds = Array.from(new Set(projects.map((p) => p.teamId).filter((id) => !!id)));

        const teamIdsAndOwners =
            teamIds.length === 0
                ? []
                : ((await (
                      await this.getEntityManager()
                  ).query(`
                SELECT member.teamId AS teamId, user.name AS owner FROM d_b_user AS user
                    LEFT JOIN d_b_team_membership AS member ON (user.id = member.userId)
                    WHERE member.teamId IN (${teamIds.map((id) => `'${id}'`).join(', ')})
                    AND member.deleted = 0
                    AND member.role = 'owner'
            `)) as { teamId: string; owner: string }[]);

        const result: (Project & { teamOwners?: string[] })[] = [];
        for (const project of projects) {
            result.push({
                ...project,
                teamOwners: teamIdsAndOwners.filter((i) => i.teamId === project.teamId).map((i) => i.owner),
            });
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

    public async findProjectsBySearchTerm(
        offset: number,
        limit: number,
        orderBy: keyof Project,
        orderDir: 'DESC' | 'ASC',
        searchTerm?: string,
    ): Promise<{ total: number; rows: Project[] }> {
        const projectRepo = await this.getRepo();

        const queryBuilder = projectRepo
            .createQueryBuilder('project')
            .where('project.cloneUrl LIKE :searchTerm', { searchTerm: `%${searchTerm}%` })
            .skip(offset)
            .take(limit)
            .orderBy(orderBy, orderDir);

        const [rows, total] = await queryBuilder.getManyAndCount();
        return { total, rows };
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
        // Delete any additional cached infos about this project
        const projectInfoRepo = await this.getProjectInfoRepo();
        const info = await projectInfoRepo.findOne({ projectId, deleted: false });
        if (info) {
            await projectInfoRepo.update(projectId, { deleted: true });
        }
    }

    public async setProjectEnvironmentVariable(
        projectId: string,
        name: string,
        value: string,
        censored: boolean,
    ): Promise<void> {
        if (!name) {
            throw new Error('Variable name cannot be empty');
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
            throw new Error(
                "Please choose a variable name containing only letters, numbers, or _, and which doesn't start with a number",
            );
        }
        const envVarRepo = await this.getProjectEnvVarRepo();
        const envVarWithValue = await envVarRepo.findOne({ projectId, name, deleted: false });
        if (envVarWithValue) {
            await envVarRepo.update(
                { id: envVarWithValue.id, projectId: envVarWithValue.projectId },
                { value, censored },
            );
            return;
        }
        await envVarRepo.save({
            id: uuidv4(),
            projectId,
            name,
            value,
            censored,
            creationTime: new Date().toISOString(),
            deleted: false,
        });
    }

    public async getProjectEnvironmentVariables(projectId: string): Promise<ProjectEnvVar[]> {
        const envVarRepo = await this.getProjectEnvVarRepo();
        const envVarsWithValue = await envVarRepo.find({ projectId, deleted: false });
        const envVars = envVarsWithValue.map(toProjectEnvVar);
        return envVars;
    }

    public async getProjectEnvironmentVariableById(variableId: string): Promise<ProjectEnvVar | undefined> {
        const envVarRepo = await this.getProjectEnvVarRepo();
        const envVarWithValue = await envVarRepo.findOne({ id: variableId, deleted: false });
        if (!envVarWithValue) {
            return;
        }
        const envVar = toProjectEnvVar(envVarWithValue);
        return envVar;
    }

    public async deleteProjectEnvironmentVariable(variableId: string): Promise<void> {
        const envVarRepo = await this.getProjectEnvVarRepo();
        const envVarWithValue = await envVarRepo.findOne({ id: variableId, deleted: false });
        if (!envVarWithValue) {
            throw new Error('A environment variable with this name could not be found for this project');
        }
        envVarWithValue.deleted = true;
        await envVarRepo.update({ id: envVarWithValue.id, projectId: envVarWithValue.projectId }, envVarWithValue);
    }

    public async getProjectEnvironmentVariableValues(envVars: ProjectEnvVar[]): Promise<ProjectEnvVarWithValue[]> {
        const envVarRepo = await this.getProjectEnvVarRepo();
        const envVarsWithValues = await envVarRepo.findByIds(envVars);
        return envVarsWithValues;
    }

    public async findCachedProjectOverview(projectId: string): Promise<Project.Overview | undefined> {
        const projectInfoRepo = await this.getProjectInfoRepo();
        const info = await projectInfoRepo.findOne({ projectId });
        return info?.overview;
    }

    public async storeCachedProjectOverview(projectId: string, overview: Project.Overview): Promise<void> {
        const projectInfoRepo = await this.getProjectInfoRepo();
        await projectInfoRepo.save({
            projectId,
            overview,
            creationTime: new Date().toISOString(),
        });
    }
}
