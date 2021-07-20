/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Project } from "@gitpod/gitpod-protocol";

export const ProjectDB = Symbol('ProjectDB');
export interface ProjectDB {
    findProjectByCloneUrl(cloneUrl: string): Promise<Project | undefined>;
    findProjectByInstallationId(installationId: string): Promise<Project | undefined>;
    findProjectsByTeam(teamId: string): Promise<Project[]>;
    storeProject(project: Project): Promise<Project>;
}