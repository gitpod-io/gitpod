/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PartialProject, Project, ProjectEnvVar, ProjectEnvVarWithValue, ProjectUsage } from "@gitpod/gitpod-protocol";
import { TransactionalDB } from "./typeorm/transactional-db-impl";

export const ProjectDB = Symbol("ProjectDB");
export interface ProjectDB extends TransactionalDB<ProjectDB> {
    findProjectById(projectId: string): Promise<Project | undefined>;
    findProjectsByCloneUrl(cloneUrl: string): Promise<Project[]>;
    findProjects(orgID: string): Promise<Project[]>;
    findProjectsBySearchTerm(
        offset: number,
        limit: number,
        orderBy: keyof Project,
        orderDir: "ASC" | "DESC",
        searchTerm: string,
    ): Promise<{ total: number; rows: Project[] }>;
    storeProject(project: Project): Promise<Project>;
    updateProject(partialProject: PartialProject): Promise<void>;
    markDeleted(projectId: string): Promise<void>;
    findProjectEnvironmentVariable(
        projectId: string,
        envVar: ProjectEnvVarWithValue,
    ): Promise<ProjectEnvVar | undefined>;
    addProjectEnvironmentVariable(projectId: string, envVar: ProjectEnvVarWithValue): Promise<void>;
    updateProjectEnvironmentVariable(projectId: string, envVar: Required<ProjectEnvVarWithValue>): Promise<void>;
    getProjectEnvironmentVariables(projectId: string): Promise<ProjectEnvVar[]>;
    getProjectEnvironmentVariableById(variableId: string): Promise<ProjectEnvVar | undefined>;
    deleteProjectEnvironmentVariable(variableId: string): Promise<void>;
    getProjectEnvironmentVariableValues(envVars: ProjectEnvVar[]): Promise<ProjectEnvVarWithValue[]>;
    findCachedProjectOverview(projectId: string): Promise<Project.Overview | undefined>;
    storeCachedProjectOverview(projectId: string, overview: Project.Overview): Promise<void>;
    getProjectUsage(projectId: string): Promise<ProjectUsage | undefined>;
    updateProjectUsage(projectId: string, usage: Partial<ProjectUsage>): Promise<void>;
}
