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
    findProjectsByCloneUrls(cloneUrls: string[]): Promise<Project[]>;
    findTeamProjects(teamId: string): Promise<Project[]>;
    findUserProjects(userId: string): Promise<Project[]>;
    storeProject(project: Project): Promise<Project>;
    setProjectConfiguration(projectId: string, config: ProjectConfig): Promise<void>;
    markDeleted(projectId: string): Promise<void>;
}
