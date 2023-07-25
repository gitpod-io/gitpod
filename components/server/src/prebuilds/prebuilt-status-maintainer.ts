/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ProbotOctokit } from "probot";
import { injectable, inject } from "inversify";
import { WorkspaceDB, TracedWorkspaceDB, DBWithTracing } from "@gitpod/gitpod-db/lib";
import { v4 as uuidv4 } from "uuid";
import { HeadlessWorkspaceEvent } from "@gitpod/gitpod-protocol/lib/headless-workspace-log";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import {
    PrebuiltWorkspaceUpdatable,
    PrebuiltWorkspace,
    Disposable,
    DisposableCollection,
    WorkspaceConfig,
} from "@gitpod/gitpod-protocol";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";
import { RedisSubscriber } from "../messaging/redis-subscriber";

export interface CheckRunInfo {
    owner: string;
    repo: string;
    head_sha: string;
    details_url: string;
}

const MAX_UPDATABLE_AGE = 6 * 60 * 60 * 1000; // 6h
const MAX_UPDATABLES = 100; // to be processed at a time
const IGNORED_UPDATEABLE_AGE = 24 * 60 * 60 * 1000; // 24h

const DEFAULT_STATUS_DESCRIPTION = "Open a prebuilt online workspace in Gitpod";
const NON_PREBUILT_STATUS_DESCRIPTION = "Open an online workspace in Gitpod";

export type AuthenticatedGithubProvider = (
    installationId: number,
) => Promise<InstanceType<typeof ProbotOctokit> | undefined>;

@injectable()
export class PrebuildStatusMaintainer implements Disposable {
    constructor(
        @inject(TracedWorkspaceDB) private readonly workspaceDB: DBWithTracing<WorkspaceDB>,
        @inject(RedisSubscriber) private readonly subscriber: RedisSubscriber,
    ) {}

    protected githubApiProvider: AuthenticatedGithubProvider;
    protected readonly disposables = new DisposableCollection();

    start(githubApiProvider: AuthenticatedGithubProvider): void {
        // set github before registering the msgbus listener - otherwise an incoming message and the github set might race
        this.githubApiProvider = githubApiProvider;

        this.disposables.pushAll([
            this.subscriber.listenForPrebuildUpdatableEvents((ctx, msg) => this.handlePrebuildFinished(ctx, msg)),
        ]);
        this.disposables.push(repeat(this.periodicUpdatableCheck.bind(this), MAX_UPDATABLE_AGE / 2));
        log.debug("prebuild updatable status maintainer started");
    }

    public async registerCheckRun(
        ctx: TraceContext,
        installationId: number,
        pws: PrebuiltWorkspace,
        cri: CheckRunInfo,
        config?: WorkspaceConfig,
    ) {
        const span = TraceContext.startSpan("registerCheckRun", ctx);
        span.setTag("pws-state", pws.state);

        try {
            const githubApi = await this.getGitHubApi(installationId);
            if (!githubApi) {
                throw new Error("unable to authenticate GitHub app");
            }

            if (pws.state == "queued" || pws.state == "building") {
                await this.workspaceDB.trace({ span }).attachUpdatableToPrebuild(pws.id, {
                    id: uuidv4(),
                    owner: cri.owner,
                    repo: cri.repo,
                    commitSHA: cri.head_sha,
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
                    description: conclusion == "success" ? DEFAULT_STATUS_DESCRIPTION : NON_PREBUILT_STATUS_DESCRIPTION,
                    state: config?.github?.prebuilds?.addCheck === "prevent-merge-on-error" ? conclusion : "success",
                });
            }
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected getConclusionFromPrebuildState(pws: PrebuiltWorkspace): "error" | "failure" | "pending" | "success" {
        if (pws.state === "aborted") {
            return "error";
        } else if (pws.state === "failed") {
            return "error";
        } else if (pws.state === "timeout") {
            return "error";
        } else if (pws.state === "queued") {
            return "pending";
        } else if (pws.state === "building") {
            return "pending";
        } else if (pws.state === "available" && !pws.error) {
            return "success";
        } else if (pws.state === "available" && !!pws.error) {
            return "failure";
        } else {
            log.warn(
                "Should have updated prebuilt workspace updatable, but don't know how. Resorting to error conclusion.",
                { pws },
            );
            return "error";
        }
    }

    protected async handlePrebuildFinished(ctx: TraceContext, msg: HeadlessWorkspaceEvent) {
        const span = TraceContext.startSpan("PrebuildStatusMaintainer.handlePrebuildFinished", ctx);

        try {
            // this code assumes that the prebuild is updated in the database before the msgbus msg is received
            const prebuild = await this.workspaceDB.trace({ span }).findPrebuildByWorkspaceID(msg.workspaceID);
            if (!prebuild) {
                log.warn("received headless log message without associated prebuild", msg);
                return;
            }

            const updatables = await this.workspaceDB.trace({ span }).findUpdatablesForPrebuild(prebuild.id);
            await Promise.all(updatables.filter((u) => !u.isResolved).map((u) => this.doUpdate({ span }, u, prebuild)));
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected async doUpdate(
        ctx: TraceContext,
        updatable: PrebuiltWorkspaceUpdatable,
        pws: PrebuiltWorkspace,
    ): Promise<void> {
        const span = TraceContext.startSpan("doUpdate", ctx);

        try {
            const githubApi = await this.getGitHubApi(Number.parseInt(updatable.installationId));
            if (!githubApi) {
                log.error("unable to authenticate GitHub app - this leaves user-facing checks dangling.");
                return;
            }
            const workspace = await this.workspaceDB.trace({ span }).findById(pws.buildWorkspaceId);

            if (!!updatable.contextUrl && !!workspace) {
                const conclusion = this.getConclusionFromPrebuildState(pws);
                if (conclusion === "pending") {
                    log.info(`Prebuild is still running.`, { prebuiltWorkspaceId: updatable.prebuiltWorkspaceId });
                    return;
                }

                try {
                    await githubApi.repos.createCommitStatus({
                        owner: updatable.owner,
                        repo: updatable.repo,
                        context: "Gitpod",
                        sha: updatable.commitSHA || pws.commit,
                        target_url: updatable.contextUrl,
                        description:
                            conclusion == "success" ? DEFAULT_STATUS_DESCRIPTION : NON_PREBUILT_STATUS_DESCRIPTION,
                        state:
                            workspace?.config?.github?.prebuilds?.addCheck === "prevent-merge-on-error"
                                ? conclusion
                                : "success",
                    });
                } catch (err) {
                    log.info("Could not create commit status.", { updatable, errorMessage: err?.message });
                    // (AT) this might happen e.g. when a commit is removed from remote repository (force push).
                    // Note, we're ignoring those errors for tracing.
                }

                await this.workspaceDB.trace({ span }).markUpdatableResolved(updatable.id);
                log.info(`Resolved updatable. Marked check on ${updatable.contextUrl} as ${conclusion}`);
            } else if (!!updatable.issue) {
                // this updatable updates a label
                log.debug("Update label on a PR - we're not using this yet");
            }
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected async getGitHubApi(installationId: number): Promise<InstanceType<typeof ProbotOctokit> | undefined> {
        const api = await this.githubApiProvider(installationId);
        if (!api) {
            return undefined;
        }
        return api as InstanceType<typeof ProbotOctokit>;
    }

    protected async periodicUpdatableCheck() {
        const ctx = TraceContext.childContext("periodicUpdatableCheck", {});

        try {
            const unresolvedUpdatables = await this.workspaceDB.trace(ctx).getUnresolvedUpdatables(MAX_UPDATABLES);
            for (const updatable of unresolvedUpdatables) {
                const age = Date.now() - Date.parse(updatable.workspace.creationTime);
                if (age > MAX_UPDATABLE_AGE && age < IGNORED_UPDATEABLE_AGE) {
                    log.info(
                        "found unresolved updatable that's older than MAX_UPDATABLE_AGE and is inconclusive. Resolving.",
                        updatable,
                    );
                    try {
                        await this.doUpdate(ctx, updatable, updatable.prebuild);
                    } catch (error) {
                        log.error("Failed to process prebuild updatable.", error, { updatable });
                    }
                }
            }
        } catch (err) {
            TraceContext.setError(ctx, err);
            throw err;
        } finally {
            ctx.span?.finish();
        }
    }

    dispose(): void {
        this.disposables.dispose();
    }
}
