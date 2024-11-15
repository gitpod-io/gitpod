/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import {
    CommitContext,
    PrebuiltWorkspace,
    TaskConfig,
    User,
    Workspace,
    WorkspaceConfig,
    WorkspaceImageSource,
} from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { PrebuiltWorkspaceState, WithCommitHistory } from "@gitpod/gitpod-protocol/lib/protocol";
import { PrebuildWithWorkspace, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { Config } from "../config";
import { HostContextProvider } from "../auth/host-context-provider";
import { ImageSourceProvider } from "../workspace/image-source-provider";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { TrustedValue } from "@gitpod/gitpod-protocol/lib/util/scrubbing";

const MAX_HISTORY_DEPTH = 100;

type IncrementalWorkspaceMatch = "none" | "incremental" | "exact";

@injectable()
export class IncrementalWorkspaceService {
    @inject(Config) protected readonly config: Config;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(ImageSourceProvider) protected readonly imageSourceProvider: ImageSourceProvider;
    @inject(WorkspaceDB) protected readonly workspaceDB: WorkspaceDB;

    public async getCommitHistoryForContext(context: CommitContext, user: User): Promise<WithCommitHistory> {
        const maxDepth = MAX_HISTORY_DEPTH;
        const hostContext = this.hostContextProvider.get(context.repository.host);
        const repoProvider = hostContext?.services?.repositoryProvider;
        if (!repoProvider) {
            return {};
        }
        const history: WithCommitHistory = {};
        history.commitHistory = await repoProvider.getCommitHistory(
            user,
            context.repository.owner,
            context.repository.name,
            context.revision,
            maxDepth,
        );

        history.commitHistory.unshift(context.revision);
        if (context.additionalRepositoryCheckoutInfo && context.additionalRepositoryCheckoutInfo.length > 0) {
            const histories = context.additionalRepositoryCheckoutInfo.map(async (info) => {
                const commitHistory = await repoProvider.getCommitHistory(
                    user,
                    info.repository.owner,
                    info.repository.name,
                    info.revision,
                    maxDepth,
                );
                commitHistory.unshift(info.revision);
                return {
                    cloneUrl: info.repository.cloneUrl,
                    commitHistory,
                };
            });
            history.additionalRepositoryCommitHistories = await Promise.all(histories);
        }
        return history;
    }

    public async findBaseForIncrementalWorkspace(
        context: CommitContext,
        config: WorkspaceConfig,
        history: WithCommitHistory,
        user: User,
        projectId: string,
        includeUnfinishedPrebuilds?: boolean,
    ): Promise<PrebuiltWorkspace | undefined> {
        if (!history.commitHistory || history.commitHistory.length < 1) {
            return;
        }

        const [recentPrebuilds, imageSource] = await Promise.allSettled([
            // Note: This query returns only not-garbage-collected prebuilds in order to reduce cardinality
            // (e.g., at the time of writing, the Gitpod repository has 16K+ prebuilds, but only ~300 not-garbage-collected)
            this.workspaceDB.findPrebuildsWithWorkspace(projectId),
            this.imageSourceProvider.getImageSource({}, user, context, config),
        ]);
        if (imageSource.status === "rejected") {
            log.error("Image source promise was rejected", { reason: imageSource.reason, userId: user.id });
            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                "Something went wrong when looking up prebuilds",
            );
        }
        if (recentPrebuilds.status === "rejected") {
            log.error("Prebuild lookup promise was rejected", { reason: recentPrebuilds.reason, userId: user.id });
            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                "Something went wrong when looking up prebuilds",
            );
        }

        // traverse prebuilds by commit history instead of their creationTime, so that we don't match prebuilds created for older revisions but triggered later
        const candidates: { candidate: PrebuildWithWorkspace; index: number }[] = [];
        for (const recentPrebuild of recentPrebuilds.value) {
            const { prebuild, workspace } = recentPrebuild;
            const { match, index } = this.isMatchForIncrementalBuild(
                history,
                config,
                imageSource.value,
                prebuild,
                workspace,
                includeUnfinishedPrebuilds,
            );
            if (match === "exact") {
                log.info("Found base for incremental build", {
                    prebuildId: prebuild.id,
                    match: new TrustedValue({
                        exact: true,
                        distanceFromContext: 0,
                    }),
                });
                return prebuild;
            }
            if (match === "incremental") {
                candidates.push({ candidate: recentPrebuild, index: index! });
            }
        }

        if (candidates.length === 0) {
            return undefined;
        }

        // Sort by index ASC
        candidates.sort((a, b) => a.index - b.index);
        const {
            candidate: { prebuild },
            index,
        } = candidates[0];

        log.info("Found base for incremental build", {
            prebuildId: prebuild.id,
            match: {
                exact: true,
                distanceFromContext: index,
            },
        });
        return prebuild;
    }

    private isMatchForIncrementalBuild(
        history: WithCommitHistory,
        config: WorkspaceConfig,
        imageSource: WorkspaceImageSource,
        candidatePrebuild: PrebuiltWorkspace,
        candidateWorkspace: Workspace,
        includeUnfinishedPrebuilds?: boolean,
    ): { match: Omit<IncrementalWorkspaceMatch, "none">; index: number } | { match: "none"; index?: undefined } {
        // make typescript happy, we know that history.commitHistory is defined
        if (!history.commitHistory) {
            return { match: "none" };
        }
        if (!CommitContext.is(candidateWorkspace.context)) {
            return { match: "none" };
        }

        const acceptableStates: PrebuiltWorkspaceState[] = ["available"];
        if (includeUnfinishedPrebuilds) {
            acceptableStates.push("building");
            acceptableStates.push("queued");
        }
        if (!acceptableStates.includes(candidatePrebuild.state)) {
            return { match: "none" };
        }

        // we are only considering full prebuilds (we are not building on top of incremental prebuilds)
        if (candidateWorkspace.basedOnPrebuildId) {
            return { match: "none" };
        }

        // check if the amount of additional repositories matches the candidate
        if (
            candidateWorkspace.context.additionalRepositoryCheckoutInfo?.length !==
            history.additionalRepositoryCommitHistories?.length
        ) {
            return { match: "none" };
        }

        const candidateCtx = candidateWorkspace.context;

        // check for overlapping commit history
        const commitIndexInHistory = history.commitHistory.indexOf(candidateCtx.revision);
        if (commitIndexInHistory === -1) {
            return { match: "none" };
        }

        // check for overlapping git history for each additional repo
        for (const subRepo of candidateWorkspace.context.additionalRepositoryCheckoutInfo ?? []) {
            const matchingRepo = history.additionalRepositoryCommitHistories?.find(
                (repo) => repo.cloneUrl === subRepo.repository.cloneUrl,
            );
            if (!matchingRepo || !matchingRepo.commitHistory.some((sha) => sha === subRepo.revision)) {
                return { match: "none" };
            }
        }

        // ensure the image source hasn't changed (skips older images)
        if (JSON.stringify(imageSource) !== JSON.stringify(candidateWorkspace.imageSource)) {
            log.debug(`Skipping parent prebuild: Outdated image`, {
                imageSource,
                parentImageSource: candidateWorkspace.imageSource,
            });
            return { match: "none" };
        }

        // ensure the tasks haven't changed
        const prebuildTasks = this.filterPrebuildTasks(config.tasks);
        const parentPrebuildTasks = this.filterPrebuildTasks(candidateWorkspace.config.tasks);
        if (JSON.stringify(prebuildTasks) !== JSON.stringify(parentPrebuildTasks)) {
            log.debug(`Skipping parent prebuild: Outdated prebuild tasks`, {
                prebuildTasks,
                parentPrebuildTasks,
            });
            return { match: "none" };
        }

        if (commitIndexInHistory === 0) {
            return { match: "exact", index: commitIndexInHistory };
        }

        return { match: "incremental", index: commitIndexInHistory };
    }

    /**
     * Given an array of tasks returns only the those which are to run during prebuilds, additionally stripping everything besides the prebuild-related configuration from them
     */
    private filterPrebuildTasks(tasks: TaskConfig[] = []): Record<string, string>[] {
        return tasks
            .map((task) => {
                const filteredTask: Record<string, any> = {};
                for (const key of Object.keys(task)) {
                    if (["before", "init", "prebuild"].includes(key)) {
                        filteredTask[key] = task[key as keyof TaskConfig];
                    }
                }
                return filteredTask;
            })
            .filter((task) => Object.keys(task).length > 0);
    }
}
