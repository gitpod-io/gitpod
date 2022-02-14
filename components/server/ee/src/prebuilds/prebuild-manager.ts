/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { DBWithTracing, TracedWorkspaceDB, WorkspaceDB } from '@gitpod/gitpod-db/lib';
import { CommitContext, CommitInfo, PrebuiltWorkspace, Project, ProjectEnvVar, StartPrebuildContext, StartPrebuildResult, TaskConfig, User, Workspace, WorkspaceConfig, WorkspaceInstance } from '@gitpod/gitpod-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { inject, injectable } from 'inversify';
import { getCommitInfo, HostContextProvider } from '../../../src/auth/host-context-provider';
import { WorkspaceFactory } from '../../../src/workspace/workspace-factory';
import { ConfigProvider } from '../../../src/workspace/config-provider';
import { WorkspaceStarter } from '../../../src/workspace/workspace-starter';
import { Config } from '../../../src/config';
import { ProjectsService } from '../../../src/projects/projects-service';

export class WorkspaceRunningError extends Error {
    constructor(msg: string, public instance: WorkspaceInstance) {
        super(msg);
    }
}

export interface StartPrebuildParams {
    user: User;
    context: CommitContext;
    project?: Project;
    commitInfo?: CommitInfo;
}

@injectable()
export class PrebuildManager {
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(WorkspaceFactory) protected readonly workspaceFactory: WorkspaceFactory;
    @inject(WorkspaceStarter) protected readonly workspaceStarter: WorkspaceStarter;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(ConfigProvider) protected readonly configProvider: ConfigProvider;
    @inject(Config) protected readonly config: Config;
    @inject(ProjectsService) protected readonly projectService: ProjectsService;

    async startPrebuild(ctx: TraceContext, { context, project, user, commitInfo }: StartPrebuildParams): Promise<StartPrebuildResult> {
        const span = TraceContext.startSpan("startPrebuild", ctx);
        const cloneURL = context.repository.cloneUrl;
        const commitSHAIdentifier = CommitContext.getCommitSHAs(context);
        span.setTag("cloneURL", cloneURL);
        span.setTag("commitSHAs", commitSHAIdentifier);
        try {
            if (user.blocked) {
                throw new Error("Blocked users cannot start prebuilds.");
            }
            const existingPB = await this.workspaceDB.trace({ span }).findPrebuiltWorkspaceByCommit(cloneURL, commitSHAIdentifier);
            // If the existing prebuild is failed, we want to retrigger it.
            if (!!existingPB && existingPB.state !== 'aborted' && existingPB.state !== 'timeout' && !existingPB.error) {
                // If the existing prebuild is based on an outdated project config, we also want to retrigger it.
                const existingPBWS = await this.workspaceDB.trace({ span }).findById(existingPB.buildWorkspaceId);
                const existingConfig = existingPBWS?.config;
                const newConfig = await this.fetchConfig({ span }, user, context);
                log.debug(`startPrebuild | commits: ${commitSHAIdentifier}, existingPB: ${existingPB.id}, existingConfig: ${JSON.stringify(existingConfig)}, newConfig: ${JSON.stringify(newConfig)}}`);
                const filterPrebuildTasks = (tasks: TaskConfig[] = []) => (tasks
                    .map(task => Object.keys(task)
                        .filter(key => ['before', 'init', 'prebuild'].includes(key))
                        // @ts-ignore
                        .reduce((obj, key) => ({ ...obj, [key]: task[key] }), {}))
                    .filter(task => Object.keys(task).length > 0));
                const isSameConfig = JSON.stringify(filterPrebuildTasks(existingConfig?.tasks)) === JSON.stringify(filterPrebuildTasks(newConfig?.tasks));
                // If there is an existing prebuild that isn't failed and it's based on the current config, we return it here instead of triggering a new prebuild.
                if (isSameConfig) {
                    return { prebuildId: existingPB.id, wsid: existingPB.buildWorkspaceId, done: true };
                }
            }

            const prebuildContext: StartPrebuildContext = {
                title: `Prebuild of "${context.title}"`,
                actual: context,
                project,
                branch: context.ref,
                normalizedContextURL: context.normalizedContextURL
            };

            if (this.shouldPrebuildIncrementally(context.repository.cloneUrl, project)) {
                const maxDepth = this.config.incrementalPrebuilds.commitHistory;
                const hostContext = this.hostContextProvider.get(context.repository.host);
                const repoProvider = hostContext?.services?.repositoryProvider;
                if (repoProvider) {
                    prebuildContext.commitHistory = await repoProvider.getCommitHistory(user, context.repository.owner, context.repository.name, context.revision, maxDepth);
                    if (context.subRepositoryCheckoutInfo && context.subRepositoryCheckoutInfo.length > 0) {
                        const histories = context.subRepositoryCheckoutInfo.map(info => repoProvider.getCommitHistory(user, info.repository.owner, info.repository.name, info.revision, maxDepth));
                        prebuildContext.subRepoCommitHistories = await Promise.all(histories);
                    }
                }
            }

            log.debug("Created prebuild context", prebuildContext);

            const projectEnvVarsPromise = project ? this.projectService.getProjectEnvironmentVariables(project.id) : [];
            const workspace = await this.workspaceFactory.createForContext({span}, user, prebuildContext, context.normalizedContextURL!);
            const prebuildPromise = this.workspaceDB.trace({span}).findPrebuildByWorkspaceID(workspace.id)!;

            span.setTag("starting", true);
            const projectEnvVars = await projectEnvVarsPromise;
            await this.workspaceStarter.startWorkspace({ span }, workspace, user, [], projectEnvVars, {excludeFeatureFlags: ['full_workspace_backup']});
            const prebuild = await prebuildPromise;
            if (!prebuild) {
                throw new Error(`Failed to create a prebuild for: ${context.normalizedContextURL}`);
            }
            if (project) {
                let aCommitInfo = commitInfo;
                if (!aCommitInfo) {
                    aCommitInfo = await getCommitInfo(this.hostContextProvider, user, context.repository.cloneUrl, context.revision);
                    if (!aCommitInfo) {
                        aCommitInfo = {
                            author: 'unknown',
                            commitMessage: 'unknown',
                            sha: context.revision
                        }
                    }
                }
                await this.storePrebuildInfo({ span }, project, prebuild, workspace, user, aCommitInfo);
            }
            return { prebuildId: prebuild.id, wsid: workspace.id, done: false };
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    async retriggerPrebuild(ctx: TraceContext, user: User, workspaceId: string): Promise<StartPrebuildResult> {
        const span = TraceContext.startSpan("retriggerPrebuild", ctx);
        span.setTag("workspaceId", workspaceId);
        try {
            const workspacePromise = this.workspaceDB.trace({ span }).findById(workspaceId);
            const prebuildPromise = this.workspaceDB.trace({ span }).findPrebuildByWorkspaceID(workspaceId);
            const runningInstance = await this.workspaceDB.trace({ span }).findRunningInstance(workspaceId);
            if (runningInstance !== undefined) {
                throw new WorkspaceRunningError('Workspace is still runnning', runningInstance);
            }
            span.setTag("starting", true);
            const workspace = await workspacePromise;
            if (!workspace) {
                console.error('Unknown workspace id.', { workspaceId });
                throw new Error('Unknown workspace ' + workspaceId);
            }
            const prebuild = await prebuildPromise;
            if (!prebuild) {
                throw new Error('No prebuild found for workspace ' + workspaceId);
            }
            let projectEnvVars: ProjectEnvVar[] = [];
            if (workspace.projectId) {
                projectEnvVars = await this.projectService.getProjectEnvironmentVariables(workspace.projectId);
            }
            await this.workspaceStarter.startWorkspace({ span }, workspace, user, [], projectEnvVars);
            return { prebuildId: prebuild.id, wsid: workspace.id, done: false };
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    shouldPrebuild(config: WorkspaceConfig | undefined): boolean {
        if (!config ||
            !config._origin ||
            config._origin !== 'repo') {
            // we demand an explicit gitpod config
            return false;
        }

        const hasPrebuildTask = !!config.tasks && config.tasks.find(t => !!t.init || !!t.prebuild);
        if (!hasPrebuildTask) {
            return false;
        }

        return true;
    }

    protected shouldPrebuildIncrementally(cloneUrl: string, project?: Project): boolean {
        if (project?.settings?.useIncrementalPrebuilds) {
            return true;
        }
        const trimRepoUrl = (url: string) => url.replace(/\/$/, '').replace(/\.git$/, '');
        const repoUrl = trimRepoUrl(cloneUrl);
        return this.config.incrementalPrebuilds.repositoryPasslist.some(url => trimRepoUrl(url) === repoUrl);
    }

    async fetchConfig(ctx: TraceContext, user: User, context: CommitContext): Promise<WorkspaceConfig> {
        const span = TraceContext.startSpan("fetchConfig", ctx);
        try {
            return (await this.configProvider.fetchConfig({ span }, user, context)).config;
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    //TODO this doesn't belong so deep here. All this context should be stored on the surface not passed down.
    protected async storePrebuildInfo(ctx: TraceContext, project: Project, pws: PrebuiltWorkspace, ws: Workspace, user: User, commit: CommitInfo) {
        const span = TraceContext.startSpan("storePrebuildInfo", ctx);
        const { userId, teamId, name: projectName, id: projectId } = project;
        await this.workspaceDB.trace({span}).storePrebuildInfo({
            id: pws.id,
            buildWorkspaceId: pws.buildWorkspaceId,
            basedOnPrebuildId: ws.basedOnPrebuildId,
            teamId,
            userId,
            projectName,
            projectId,
            startedAt: pws.creationTime,
            startedBy: "", // TODO
            startedByAvatar: "", // TODO
            cloneUrl: pws.cloneURL,
            branch: pws.branch || "unknown",
            changeAuthor: commit.author,
            changeAuthorAvatar: commit.authorAvatarUrl,
            changeDate: commit.authorDate || "",
            changeHash: commit.sha,
            changeTitle: commit.commitMessage,
            // changePR
            changeUrl: ws.contextURL,
        });
    }

}