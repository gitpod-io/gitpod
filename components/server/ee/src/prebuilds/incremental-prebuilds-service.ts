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
import { WithCommitHistory } from "@gitpod/gitpod-protocol/src/protocol";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { Config } from "../../../src/config";
import { ConfigProvider } from "../../../src/workspace/config-provider";
import { HostContextProvider } from "../../../src/auth/host-context-provider";
import { ImageSourceProvider } from "../../../src/workspace/image-source-provider";

@injectable()
export class IncrementalPrebuildsService {
    @inject(Config) protected readonly config: Config;
    @inject(ConfigProvider) protected readonly configProvider: ConfigProvider;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(ImageSourceProvider) protected readonly imageSourceProvider: ImageSourceProvider;
    @inject(WorkspaceDB) protected readonly workspaceDB: WorkspaceDB;

    public async getCommitHistoryForContext(context: CommitContext, user: User): Promise<WithCommitHistory> {
        const maxDepth = this.config.incrementalPrebuilds.commitHistory;
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
        if (context.additionalRepositoryCheckoutInfo && context.additionalRepositoryCheckoutInfo.length > 0) {
            const histories = context.additionalRepositoryCheckoutInfo.map(async (info) => {
                const commitHistory = await repoProvider.getCommitHistory(
                    user,
                    info.repository.owner,
                    info.repository.name,
                    info.revision,
                    maxDepth,
                );
                return {
                    cloneUrl: info.repository.cloneUrl,
                    commitHistory,
                };
            });
            history.additionalRepositoryCommitHistories = await Promise.all(histories);
        }
        return history;
    }

    public async findGoodBaseForIncrementalBuild(
        context: CommitContext,
        config: WorkspaceConfig,
        history: WithCommitHistory,
        user: User,
    ): Promise<PrebuiltWorkspace | undefined> {
        if (!history.commitHistory || history.commitHistory.length < 1) {
            return;
        }

        const imageSource = await this.imageSourceProvider.getImageSource({}, user, context, config);

        // Note: This query returns only not-garbage-collected prebuilds in order to reduce cardinality
        // (e.g., at the time of writing, the Gitpod repository has 16K+ prebuilds, but only ~300 not-garbage-collected)
        const recentPrebuilds = await this.workspaceDB.findPrebuildsWithWorkpace(context.repository.cloneUrl);
        for (const recentPrebuild of recentPrebuilds) {
            if (
                await this.isGoodBaseforIncrementalBuild(
                    history,
                    config,
                    imageSource,
                    recentPrebuild.prebuild,
                    recentPrebuild.workspace,
                )
            ) {
                return recentPrebuild.prebuild;
            }
        }
    }

    protected async isGoodBaseforIncrementalBuild(
        history: WithCommitHistory,
        config: WorkspaceConfig,
        imageSource: WorkspaceImageSource,
        candidatePrebuild: PrebuiltWorkspace,
        candidateWorkspace: Workspace,
    ): Promise<boolean> {
        if (!history.commitHistory || history.commitHistory.length === 0) {
            return false;
        }
        if (!CommitContext.is(candidateWorkspace.context)) {
            return false;
        }

        // we are only considering available prebuilds
        if (candidatePrebuild.state !== "available") {
            return false;
        }

        // we are only considering full prebuilds
        if (!!candidateWorkspace.basedOnPrebuildId) {
            return false;
        }

        if (
            candidateWorkspace.context.additionalRepositoryCheckoutInfo?.length !==
            history.additionalRepositoryCommitHistories?.length
        ) {
            // different number of repos
            return false;
        }

        const candidateCtx = candidateWorkspace.context;
        if (!history.commitHistory.some((sha) => sha === candidateCtx.revision)) {
            return false;
        }

        // check the commits are included in the commit history
        for (const subRepo of candidateWorkspace.context.additionalRepositoryCheckoutInfo || []) {
            const matchIngRepo = history.additionalRepositoryCommitHistories?.find(
                (repo) => repo.cloneUrl === subRepo.repository.cloneUrl,
            );
            if (!matchIngRepo || !matchIngRepo.commitHistory.some((sha) => sha === subRepo.revision)) {
                return false;
            }
        }

        // ensure the image source hasn't changed (skips older images)
        if (JSON.stringify(imageSource) !== JSON.stringify(candidateWorkspace.imageSource)) {
            log.debug(`Skipping parent prebuild: Outdated image`, {
                imageSource,
                parentImageSource: candidateWorkspace.imageSource,
            });
            return false;
        }

        // ensure the tasks haven't changed
        const filterPrebuildTasks = (tasks: TaskConfig[] = []) =>
            tasks
                .map((task) =>
                    Object.keys(task)
                        .filter((key) => ["before", "init", "prebuild"].includes(key))
                        // @ts-ignore
                        .reduce((obj, key) => ({ ...obj, [key]: task[key] }), {}),
                )
                .filter((task) => Object.keys(task).length > 0);
        const prebuildTasks = filterPrebuildTasks(config.tasks);
        const parentPrebuildTasks = filterPrebuildTasks(candidateWorkspace.config.tasks);
        if (JSON.stringify(prebuildTasks) !== JSON.stringify(parentPrebuildTasks)) {
            log.debug(`Skipping parent prebuild: Outdated prebuild tasks`, {
                prebuildTasks,
                parentPrebuildTasks,
            });
            return false;
        }

        return true;
    }
}
