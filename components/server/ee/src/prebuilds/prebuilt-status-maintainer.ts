/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { ProbotOctokit } from 'probot';
import { injectable, inject } from 'inversify';
import { WorkspaceDB, TracedWorkspaceDB, DBWithTracing } from '@gitpod/gitpod-db/lib';
import { v4 as uuidv4 } from 'uuid';
import { MessageBusIntegration } from '../../../src/workspace/messagebus-integration';
import { HeadlessWorkspaceEvent } from '@gitpod/gitpod-protocol/lib/headless-workspace-log';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { PrebuiltWorkspaceUpdatable, PrebuiltWorkspace, Disposable } from '@gitpod/gitpod-protocol';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';

export interface CheckRunInfo {
    owner: string;
    repo: string;
    head_sha: string;
    details_url: string;
}

// 6 hours
const MAX_UPDATABLE_AGE = 6 * 60 * 60 * 1000;
const DEFAULT_STATUS_DESCRIPTION = "Open a prebuilt online workspace in Gitpod";
const NON_PREBUILT_STATUS_DESCRIPTION = "Open an online workspace in Gitpod";

export type AuthenticatedGithubProvider = (installationId: number) => Promise<InstanceType<typeof ProbotOctokit> | undefined>;

@injectable()
export class PrebuildStatusMaintainer implements Disposable {
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(MessageBusIntegration) protected readonly messagebus: MessageBusIntegration;
    protected githubApiProvider: AuthenticatedGithubProvider;
    protected messagebusListener?: Disposable;
    protected periodicChecker?: NodeJS.Timer;

    start(githubApiProvider: AuthenticatedGithubProvider): void {
        // set github before registering the msgbus listener - otherwise an incoming message and the github set might race
        this.githubApiProvider = githubApiProvider;

        this.messagebusListener = this.messagebus.listenForPrebuildUpdatableQueue((ctx, msg) => this.handlePrebuildFinished(ctx, msg));
        this.periodicChecker = setInterval(this.periodicUpdatableCheck.bind(this), 60 * 1000) as any as NodeJS.Timer;
        log.debug("prebuild updatatable status maintainer started");
    }

    public async registerCheckRun(ctx: TraceContext, installationId: number, pws: PrebuiltWorkspace, cri: CheckRunInfo) {
        const span = TraceContext.startSpan("registerCheckRun", ctx);
        span.setTag("pws-state", pws.state);

        try {
            const githubApi = await this.getGitHubApi(installationId);
            if (!githubApi) {
                throw new Error("unable to authenticate GitHub app");
            }

            if (pws.state == 'queued' || pws.state == "building") {
                await this.workspaceDB.trace({span}).attachUpdatableToPrebuild(pws.id, {
                    id: uuidv4(),
                    owner: cri.owner,
                    repo: cri.repo,
                    isResolved: false,
                    installationId: installationId.toString(),
                    contextUrl: cri.details_url,
                    prebuiltWorkspaceId: pws.id,
                });
                await githubApi.repos.createCommitStatus({
                    repo: cri.repo,
                    owner: cri.owner,
                    sha: cri.head_sha,
                    target_url: cri.details_url,
                    context: "Gitpod",
                    description: "prebuilding an online workspace for this PR",
                    state: "pending",
                });
            } else {
                // prebuild isn't running - mark with check
                const conclusion = this.getConclusionFromPrebuildState(pws);
                await githubApi.repos.createCommitStatus({
                    repo: cri.repo,
                    owner: cri.owner,
                    sha: cri.head_sha,
                    target_url: cri.details_url,
                    context: "Gitpod",
                    description: conclusion == 'success' ? DEFAULT_STATUS_DESCRIPTION : NON_PREBUILT_STATUS_DESCRIPTION,

                    // at the moment we run in 'evergreen' mode where we always report success for status checks
                    state: "success",
                });
            }
        } catch (err) {
            TraceContext.logError({span}, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected getConclusionFromPrebuildState(pws: PrebuiltWorkspace): "error" | "failure" | "pending" | "success" {
        if (pws.state === "aborted") {
            return "error";
        } else if (pws.state === "queued") {
            return "pending";
        } else if (pws.state === "timeout") {
            return "error";
        } else if (pws.state === "available" && !pws.error) {
            return "success";
        } else if (pws.state === "available" && !!pws.error) {
            // Not sure if this is the right choice - do we really want the check to fail if the prebuild fails?
            return "failure";
        } else if (pws.state === "building") {
            return "pending";
        } else {
            log.warn("Should have updated prebuilt workspace updatable, but don't know how. Resorting to error conclusion.", { pws });
            return "error";
        }
    }

    protected async handlePrebuildFinished(ctx: TraceContext, msg: HeadlessWorkspaceEvent) {
        const span = TraceContext.startSpan("PrebuildStatusMaintainer.handlePrebuildFinished", ctx)

        try {
            // this code assumes that the prebuild is updated in the database before the msgbus msg is received
            const prebuild = await this.workspaceDB.trace({span}).findPrebuildByWorkspaceID(msg.workspaceID);
            if (!prebuild) {
                log.warn("received headless log message without associated prebuild", msg);
                return;
            }

            const updatatables = await this.workspaceDB.trace({span}).findUpdatablesForPrebuild(prebuild.id);
            await Promise.all(updatatables.filter(u => !u.isResolved).map(u => this.doUpdate({span}, u, prebuild)));
        } catch (err) {
            TraceContext.logError({span}, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected async doUpdate(ctx: TraceContext, updatatable: PrebuiltWorkspaceUpdatable, pws: PrebuiltWorkspace): Promise<void> {
        const span = TraceContext.startSpan("doUpdate", ctx);

        try {
            const githubApi = await this.getGitHubApi(Number.parseInt(updatatable.installationId));
            if (!githubApi) {
                log.error("unable to authenticate GitHub app - this leaves user-facing checks dangling.");
                return;
            }

            if (!!updatatable.contextUrl) {
                const conclusion = this.getConclusionFromPrebuildState(pws);

                let found = true;
                try {
                    await githubApi.repos.createCommitStatus({
                        owner: updatatable.owner,
                        repo: updatatable.repo,
                        context: "Gitpod",
                        sha: pws.commit,
                        target_url: updatatable.contextUrl,
                        // at the moment we run in 'evergreen' mode where we always report success for status checks
                        description: conclusion == 'success' ? DEFAULT_STATUS_DESCRIPTION : NON_PREBUILT_STATUS_DESCRIPTION,
                        state: "success"
                    });
                } catch (err) {
                    if (err.message == "Not Found") {
                        log.info("Did not find repository while updating updatable. Probably we lost the GitHub permission for the repo.", {owner: updatatable.owner, repo: updatatable.repo});
                        found = true;
                    } else {
                        throw err;
                    }
                }
                span.log({ 'update': 'done', 'found': found });

                await this.workspaceDB.trace({span}).markUpdatableResolved(updatatable.id);
                log.info(`Resolved updatable. Marked check on ${updatatable.contextUrl} as ${conclusion}`);
            } else if (!!updatatable.issue) {
                // this updatatable updates a label
                log.debug("Update label on a PR - we're not using this yet");
            }
        } catch (err) {
            TraceContext.logError({span}, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected async getGitHubApi(installationId: number): Promise<InstanceType<typeof ProbotOctokit> | undefined> {
        const api = await this.githubApiProvider(installationId);
        if (!api) {
            return undefined
        }
        return (api as InstanceType<typeof ProbotOctokit>);
    }

    protected async periodicUpdatableCheck() {
        const unresolvedUpdatables = await this.workspaceDB.trace({}).getUnresolvedUpdatables();

        for (const updatable of unresolvedUpdatables) {
            if ((Date.now() - Date.parse(updatable.workspace.creationTime)) > MAX_UPDATABLE_AGE) {
                log.info("found unresolved updatable that's older than MAX_UPDATABLE_AGE and is inconclusive. Resolving.", updatable);
                await this.doUpdate({}, updatable, updatable.prebuild);
            }
        }
    }

    dispose(): void {
        if (this.messagebusListener) {
            this.messagebusListener.dispose();
            this.messagebusListener = undefined;
        }
        if (this.periodicChecker !== undefined) {
            clearInterval(this.periodicChecker);
            this.periodicChecker = undefined;
        }
    }
}
