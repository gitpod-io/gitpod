/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Project, ProjectConfig } from "@gitpod/gitpod-protocol";

export const ProjectDB = Symbol('ProjectDB');
export interface ProjectDB {
    findProjectById(projectId: string): Promise<Project | undefined>;
    findProjectByCloneUrl(cloneUrl: string): Promise<Project | undefined>;
    findProjectsByCloneUrl(cloneUrls: string[]): Promise<Project[]>;
    findProjectById(projectId: string): Promise<Project | undefined>;
    findProject(teamId: string, projectName: string): Promise<Project | undefined>;
    findProjectByInstallationId(installationId: string): Promise<Project | undefined>;
    findProjectsByTeam(teamId: string): Promise<Project[]>;
    storeProject(project: Project): Promise<Project>;
    setProjectConfiguration(projectId: string, config: ProjectConfig): Promise<void>;
    markDeleted(projectId: string): Promise<void>;
}