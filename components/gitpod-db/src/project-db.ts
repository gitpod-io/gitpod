/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { PartialProject, Project, ProjectEnvVar, ProjectEnvVarWithValue } from "@gitpod/gitpod-protocol";

export const ProjectDB = Symbol('ProjectDB');
export interface ProjectDB {
    findProjectById(projectId: string): Promise<Project | undefined>;
    findProjectByCloneUrl(cloneUrl: string): Promise<Project | undefined>;
    findProjectsByCloneUrls(cloneUrls: string[]): Promise<(Project & { teamOwners?: string[] })[]>;
    findTeamProjects(teamId: string): Promise<Project[]>;
    findUserProjects(userId: string): Promise<Project[]>;
    storeProject(project: Project): Promise<Project>;
    updateProject(partialProject: PartialProject): Promise<void>;
    markDeleted(projectId: string): Promise<void>;
    setProjectEnvironmentVariable(projectId: string, name: string, value: string): Promise<void>;
    getProjectEnvironmentVariables(projectId: string): Promise<ProjectEnvVar[]>;
    getProjectEnvironmentVariableById(variableId: string): Promise<ProjectEnvVar | undefined>;
    deleteProjectEnvironmentVariable(variableId: string): Promise<void>;
    getProjectEnvironmentVariableValues(envVars: ProjectEnvVar[]): Promise<ProjectEnvVarWithValue[]>;
}
