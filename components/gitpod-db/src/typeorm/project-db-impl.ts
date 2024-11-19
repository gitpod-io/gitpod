/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PartialProject, Project, ProjectEnvVar, ProjectEnvVarWithValue, ProjectUsage } from "@gitpod/gitpod-protocol";
import { EncryptionService } from "@gitpod/gitpod-protocol/lib/encryption/encryption-service";
import { inject, injectable, optional } from "inversify";
import { Brackets, EntityManager, FindConditions, Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { ProjectDB, FindProjectsBySearchTermArgs } from "../project-db";
import { DBProject } from "./entity/db-project";
import { DBProjectEnvVar } from "./entity/db-project-env-vars";
import { DBProjectInfo } from "./entity/db-project-info";
import { DBProjectUsage } from "./entity/db-project-usage";
import { TransactionalDBImpl } from "./transactional-db-impl";
import { TypeORM } from "./typeorm";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { filter } from "../utils";

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

    public async findProjectsByCloneUrl(cloneUrl: string, organizationId?: string): Promise<Project[]> {
        const repo = await this.getRepo();
        const conditions: FindConditions<DBProject> = { cloneUrl, markedDeleted: false };
        if (organizationId) {
            conditions.teamId = organizationId;
        }
        return repo.find(conditions);
    }

    public async findProjects(orgId: string, limit?: number): Promise<Project[]> {
        const repo = await this.getRepo();

        const queryBuilder = repo
            .createQueryBuilder("project")
            .where("project.teamId = :teamId", { teamId: orgId })
            .orderBy("project.creationTime", "DESC")
            .andWhere("project.markedDeleted = false");

        if (limit) {
            queryBuilder.take(limit);
        }

        return queryBuilder.getMany();
    }

    public async findProjectsBySearchTerm({
        offset,
        limit,
        orderBy,
        orderDir,
        searchTerm,
        organizationId,
        prebuildsEnabled,
    }: FindProjectsBySearchTermArgs): Promise<{ total: number; rows: Project[] }> {
        const projectRepo = await this.getRepo();
        const normalizedSearchTerm = searchTerm?.trim();

        const queryBuilder = projectRepo
            .createQueryBuilder("project")
            .where("project.markedDeleted = false")
            .skip(offset)
            .take(limit)
            .orderBy(orderBy, orderDir);

        if (organizationId) {
            queryBuilder.andWhere("project.teamId = :organizationId", { organizationId });
        }

        if (normalizedSearchTerm) {
            queryBuilder.andWhere(
                new Brackets((qb) => {
                    qb.where("project.cloneUrl LIKE :searchTerm", { searchTerm: `%${normalizedSearchTerm}%` }).orWhere(
                        "project.name LIKE :searchTerm",
                        { searchTerm: `%${normalizedSearchTerm}%` },
                    );
                }),
            );
        }

        if (prebuildsEnabled !== undefined) {
            queryBuilder.andWhere("project.settings->>'$.prebuilds.enable' = :enabled", {
                enabled: prebuildsEnabled ? "true" : "false",
            });
        }

        const [rows, total] = await queryBuilder.getManyAndCount();
        return { total, rows };
    }

    public async storeProject(project: Project): Promise<Project> {
        const repo = await this.getRepo();
        return repo.save(project);
    }

    public async updateProject(partialProject: PartialProject): Promise<DBProject> {
        const repo = await this.getRepo();
        const count = await repo.count({ id: partialProject.id, markedDeleted: false });
        if (count < 1) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `project with ID ${partialProject.id} not found`);
        }
        await repo.update(partialProject.id, partialProject);
        const project = await repo.findOne({ id: partialProject.id, markedDeleted: false });
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `project with ID ${partialProject.id} not found`);
        }

        return project;
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

    public async addProjectEnvironmentVariable(
        projectId: string,
        envVar: ProjectEnvVarWithValue,
    ): Promise<ProjectEnvVar> {
        const envVarRepo = await this.getProjectEnvVarRepo();
        const insertedEnvVar = await envVarRepo.save({
            id: uuidv4(),
            projectId,
            name: envVar.name,
            value: envVar.value,
            censored: envVar.censored,
            creationTime: new Date().toISOString(),
            deleted: false,
        });
        return toProjectEnvVar(insertedEnvVar);
    }

    public async updateProjectEnvironmentVariable(
        projectId: string,
        envVar: Partial<ProjectEnvVarWithValue>,
    ): Promise<ProjectEnvVar | undefined> {
        if (!envVar.id) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "An environment variable with this ID could not be found");
        }

        return await this.transaction(async (_, ctx) => {
            const envVarRepo = ctx.entityManager.getRepository<DBProjectEnvVar>(DBProjectEnvVar);

            await envVarRepo.update(
                { id: envVar.id, projectId },
                filter(envVar, (_, v) => v !== null && v !== undefined),
            );

            const found = await envVarRepo.findOne({ id: envVar.id, projectId, deleted: false });
            if (!found) {
                return;
            }
            return toProjectEnvVar(found);
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
        await envVarRepo.delete({ id: variableId });
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
