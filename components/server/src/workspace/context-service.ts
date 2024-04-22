/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceDB, DBWithTracing, TracedWorkspaceDB } from "@gitpod/gitpod-db/lib";
import {
    CommitContext,
    PrebuiltWorkspace,
    PrebuiltWorkspaceContext,
    User,
    WorkspaceContext,
    Project,
    SnapshotContext,
} from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { inject, injectable } from "inversify";
import { ContextParser } from "./context-parser-service";
import { ConfigProvider } from "./config-provider";
import { ProjectsService } from "../projects/projects-service";
import { OpenPrebuildContext, WithDefaultConfig } from "@gitpod/gitpod-protocol/lib/protocol";
import { IncrementalWorkspaceService } from "../prebuilds/incremental-workspace-service";
import { Authorizer } from "../authorization/authorizer";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class ContextService {
    constructor(
        @inject(TracedWorkspaceDB) private readonly workspaceDb: DBWithTracing<WorkspaceDB>,
        @inject(ContextParser) private contextParser: ContextParser,
        @inject(IncrementalWorkspaceService) private readonly incrementalPrebuildsService: IncrementalWorkspaceService,
        @inject(ConfigProvider) private readonly configProvider: ConfigProvider,

        @inject(ProjectsService) private readonly projectsService: ProjectsService,

        @inject(Authorizer) private readonly auth: Authorizer,
    ) {}

    private async findPrebuiltWorkspace(
        user: User,
        projectId: string,
        context: WorkspaceContext,
        organizationId?: string,
    ): Promise<PrebuiltWorkspaceContext | undefined> {
        if (!(CommitContext.is(context) && context.repository.cloneUrl && context.revision)) {
            return;
        }

        const cloneUrl = context.repository.cloneUrl;
        let prebuiltWorkspace: PrebuiltWorkspace | undefined;
        if (OpenPrebuildContext.is(context)) {
            prebuiltWorkspace = await this.workspaceDb.trace({}).findPrebuildByID(context.openPrebuildID);
            if (prebuiltWorkspace?.cloneURL !== cloneUrl) {
                // prevent users from opening arbitrary prebuilds this way - they must match the clone URL so that the resource guards are correct.
                return undefined;
            }
        } else {
            const configPromise = this.configProvider.fetchConfig({}, user, context, organizationId);
            const history = await this.incrementalPrebuildsService.getCommitHistoryForContext(context, user);
            const { config } = await configPromise;
            prebuiltWorkspace = await this.incrementalPrebuildsService.findGoodBaseForIncrementalBuild(
                context,
                config,
                history,
                user,
                projectId,
            );
        }
        if (!prebuiltWorkspace?.projectId) {
            return undefined;
        }

        // check if the user has access to the project
        if (!(await this.auth.hasPermissionOnProject(user.id, "read_prebuild", prebuiltWorkspace.projectId))) {
            return undefined;
        }
        const result: PrebuiltWorkspaceContext = {
            title: context.title,
            originalContext: context,
            prebuiltWorkspace,
        };
        return result;
    }

    /**
     * parseContextUrl without snapshot and prebuild checking
     * @deprecated
     */
    public async parseContextUrl(user: User, contextUrl: string): Promise<WorkspaceContext> {
        let normalizedContextUrl = "";
        try {
            normalizedContextUrl = this.contextParser.normalizeContextURL(contextUrl);
            return await this.contextParser.handle({}, user, normalizedContextUrl);
        } catch (error) {
            if (ApplicationError.hasErrorCode(error)) {
                // specific errors will be handled in create-workspace.tsx
                throw error;
            }
            // TODO(ak) not sure about it we shovel all errors in context parsing error
            // we should rather do internal errors, and categorize at sources
            log.debug(error);
            throw new ApplicationError(
                ErrorCodes.CONTEXT_PARSE_ERROR,
                error ? String(error) : `Cannot create workspace for URL: ${normalizedContextUrl}`,
            );
        }
    }

    public async parseContextUrlAsCloneUrl(user: User, contextUrl: string): Promise<string | undefined> {
        const normalizedContextUrl = this.contextParser.normalizeContextURL(contextUrl);
        const context = await this.contextParser.handle({}, user, normalizedContextUrl);
        if (CommitContext.is(context)) {
            return context.repository.cloneUrl;
        }

        return undefined;
    }

    public async parseContext(
        user: User,
        contextUrl: string,
        options?: { projectId?: string; organizationId?: string; forceDefaultConfig?: boolean },
    ): Promise<{ context: WorkspaceContext; project?: Project }> {
        const normalizedContextUrl = this.contextParser.normalizeContextURL(contextUrl);

        let context = await this.contextParser.handle({}, user, normalizedContextUrl);

        if (SnapshotContext.is(context)) {
            // TODO(janx): Remove snapshot access tracking once we're certain that enforcing repository read access doesn't disrupt the snapshot UX.
            const snapshot = await this.workspaceDb.trace({}).findSnapshotById(context.snapshotId);
            if (!snapshot) {
                throw new ApplicationError(
                    ErrorCodes.NOT_FOUND,
                    "No snapshot with id '" + context.snapshotId + "' found.",
                );
            }
            const workspace = await this.workspaceDb.trace({}).findById(snapshot.originalWorkspaceId);
            if (!workspace) {
                throw new ApplicationError(
                    ErrorCodes.NOT_FOUND,
                    "No workspace with id '" + snapshot.originalWorkspaceId + "' found.",
                );
            }

            // TODO: Snapshot permission check should be addressed with FGA in the future.
        }

        // if we're forced to use the default config, mark the context as such
        if (!!options?.forceDefaultConfig) {
            context = WithDefaultConfig.mark(context);
        }

        let project: Project | undefined = undefined;
        if (options?.projectId) {
            project = await this.projectsService.getProject(user.id, options.projectId);
        } else if (CommitContext.is(context)) {
            const projects = await this.projectsService.findProjectsByCloneUrl(
                user.id,
                context.repository.cloneUrl,
                options?.organizationId,
            );
            if (projects.length > 1) {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Multiple projects found for clone URL.");
            }
            if (projects.length === 1) {
                project = projects[0];
            }
        }

        const prebuiltWorkspace =
            project?.settings?.prebuilds?.enable && options?.organizationId
                ? await this.findPrebuiltWorkspace(user, project.id, context, options.organizationId)
                : undefined;
        if (WorkspaceContext.is(prebuiltWorkspace)) {
            context = prebuiltWorkspace;
        }

        return { context, project };
    }
}
