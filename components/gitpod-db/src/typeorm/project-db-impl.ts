/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PartialProject, Project, ProjectEnvVar, ProjectEnvVarWithValue, ProjectUsage } from "@gitpod/gitpod-protocol";
import { EncryptionService } from "@gitpod/gitpod-protocol/lib/encryption/encryption-service";
import { inject, injectable, optional } from "inversify";
import { EntityManager, FindConditions, Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { ProjectDB } from "../project-db";
import { DBProject } from "./entity/db-project";
import { DBProjectEnvVar } from "./entity/db-project-env-vars";
import { DBProjectInfo } from "./entity/db-project-info";
import { DBProjectUsage } from "./entity/db-project-usage";
import { TransactionalDBImpl } from "./transactional-db-impl";
import { TypeORM } from "./typeorm";

function toProjectEnvVar(envVarWithValue: DBProjectEnvVar): ProjectEnvVar {
    const envVar = { ...envVarWithValue };
    delete (envVar as any)["value"];
    return envVar;
}

@injectable()
export class ProjectDBImpl extends TransactionalDBImpl<ProjectDB> implements ProjectDB {
    constructor(
        @inject(TypeORM) typeorm: TypeORM,
        @inject(EncryptionService) private readonly encryptionService: EncryptionService,
        @optional() transactionalEM?: EntityManager,
    ) {
        super(typeorm, transactionalEM);
    }

    protected createTransactionalDB(transactionalEM: EntityManager): ProjectDB {
        return new ProjectDBImpl(this.typeorm, this.encryptionService, transactionalEM);
    }

    private async getRepo(): Promise<Repository<DBProject>> {
        return (await this.getEntityManager()).getRepository<DBProject>(DBProject);
    }

    private async getProjectEnvVarRepo(): Promise<Repository<DBProjectEnvVar>> {
        return (await this.getEntityManager()).getRepository<DBProjectEnvVar>(DBProjectEnvVar);
    }

    private async getProjectInfoRepo(): Promise<Repository<DBProjectInfo>> {
        return (await this.getEntityManager()).getRepository<DBProjectInfo>(DBProjectInfo);
    }

    private async getProjectUsageRepo(): Promise<Repository<DBProjectUsage>> {
        return (await this.getEntityManager()).getRepository<DBProjectUsage>(DBProjectUsage);
    }

    public async findProjectById(projectId: string): Promise<Project | undefined> {
        const repo = await this.getRepo();
        return repo.findOne({ id: projectId, markedDeleted: false });
    }

    public async findProjectsByCloneUrl(cloneUrl: string): Promise<Project[]> {
        const repo = await this.getRepo();
        const conditions: FindConditions<DBProject> = { cloneUrl, markedDeleted: false };
        return repo.find(conditions);
    }

    public async findProjects(orgId: string): Promise<Project[]> {
        const repo = await this.getRepo();
        return repo.find({ where: { teamId: orgId, markedDeleted: false }, order: { name: "ASC" } });
    }

    public async findProjectsBySearchTerm(
        offset: number,
        limit: number,
        orderBy: keyof Project,
        orderDir: "DESC" | "ASC",
        searchTerm?: string,
    ): Promise<{ total: number; rows: Project[] }> {
        const projectRepo = await this.getRepo();

        const queryBuilder = projectRepo
            .createQueryBuilder("project")
            .where("project.cloneUrl LIKE :searchTerm", { searchTerm: `%${searchTerm}%` })
            .andWhere("project.markedDeleted = false")
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
            throw new Error("A project with this ID could not be found");
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
        const projectUsageRepo = await this.getProjectUsageRepo();
        await projectUsageRepo.delete({ projectId });
    }

    public async findProjectEnvironmentVariable(
        projectId: string,
        envVar: ProjectEnvVarWithValue,
    ): Promise<ProjectEnvVar | undefined> {
        const envVarRepo = await this.getProjectEnvVarRepo();
        return envVarRepo.findOne({ projectId, name: envVar.name, deleted: false });
    }

    public async addProjectEnvironmentVariable(projectId: string, envVar: ProjectEnvVarWithValue): Promise<void> {
        const envVarRepo = await this.getProjectEnvVarRepo();
        await envVarRepo.save({
            id: uuidv4(),
            projectId,
            name: envVar.name,
            value: envVar.value,
            censored: envVar.censored,
            creationTime: new Date().toISOString(),
            deleted: false,
        });
    }

    public async updateProjectEnvironmentVariable(
        projectId: string,
        envVar: Required<ProjectEnvVarWithValue>,
    ): Promise<void> {
        const envVarRepo = await this.getProjectEnvVarRepo();
        await envVarRepo.update({ id: envVar.id, projectId }, { value: envVar.value, censored: envVar.censored });
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
            throw new Error("A environment variable with this name could not be found for this project");
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

    public async getProjectUsage(projectId: string): Promise<ProjectUsage | undefined> {
        const projectUsageRepo = await this.getProjectUsageRepo();
        const usage = await projectUsageRepo.findOne({ projectId });
        if (usage) {
            return {
                lastWebhookReceived: usage.lastWebhookReceived,
                lastWorkspaceStart: usage.lastWorkspaceStart,
            };
        }
    }

    public async updateProjectUsage(projectId: string, usage: Partial<ProjectUsage>): Promise<void> {
        const projectUsageRepo = await this.getProjectUsageRepo();
        await projectUsageRepo.save({
            projectId,
            ...usage,
        });
    }
}
