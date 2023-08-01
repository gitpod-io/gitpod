/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ProjectDB, UserDB } from "@gitpod/gitpod-db/lib";
import {
    CommitContext,
    EnvVar,
    ProjectEnvVar,
    UserEnvVar,
    WithEnvvarsContext,
    Workspace,
} from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { ProjectsService } from "../projects/projects-service";
import { ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";

export interface ResolvedEnvVars {
    // all project env vars, censored included always
    project: ProjectEnvVar[];
    // merged workspace env vars
    workspace: EnvVar[];
}

@injectable()
export class EnvVarService {
    @inject(UserDB)
    private userDB: UserDB;

    @inject(ProjectsService)
    private projectsService: ProjectsService;

    @inject(ProjectDB)
    private projectDB: ProjectDB;

    async resolve(workspace: Workspace): Promise<ResolvedEnvVars> {
        const workspaceEnvVars = new Map<String, EnvVar>();
        const merge = (envs: EnvVar[]) => {
            for (const env of envs) {
                workspaceEnvVars.set(env.name, env);
            }
        };

        const projectEnvVars = workspace.projectId
            ? (await ApplicationError.notFoundToUndefined(
                  this.projectsService.getProjectEnvironmentVariables(workspace.ownerId, workspace.projectId),
              )) || []
            : [];

        if (workspace.type === "prebuild") {
            // prebuild does not have access to user env vars and cannot be started via prewfix URL
            const withValues = await this.projectDB.getProjectEnvironmentVariableValues(projectEnvVars);
            merge(withValues);
            return {
                project: projectEnvVars,
                workspace: [...workspaceEnvVars.values()],
            };
        }

        // 1. first merge user envs
        if (CommitContext.is(workspace.context)) {
            // this is a commit context, thus we can filter the env vars
            const userEnvVars = await this.userDB.getEnvVars(workspace.ownerId);
            merge(
                UserEnvVar.filter(userEnvVars, workspace.context.repository.owner, workspace.context.repository.name),
            );
        }

        // 2. then from the project
        if (projectEnvVars.length) {
            // Instead of using an access guard for Project environment variables, we let Project owners decide whether
            // a variable should be:
            //   - exposed in all workspaces (even for non-Project members when the repository is public), or
            //   - censored from all workspaces (even for Project members)
            const availablePrjEnvVars = projectEnvVars.filter((variable) => !variable.censored);
            const withValues = await this.projectDB.getProjectEnvironmentVariableValues(availablePrjEnvVars);
            merge(withValues);
        }

        // 3. then parsed from the context URL
        if (WithEnvvarsContext.is(workspace.context)) {
            merge(workspace.context.envvars);
        }

        return {
            project: projectEnvVars,
            workspace: [...workspaceEnvVars.values()],
        };
    }
}
