/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { v4 as uuidv4 } from "uuid";
import { WorkspaceFactory } from "../../../src/workspace/workspace-factory";
import { injectable, inject } from "inversify";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import {
    User,
    StartPrebuildContext,
    Workspace,
    CommitContext,
    PrebuiltWorkspaceContext,
    WorkspaceContext,
    WithSnapshot,
    WithPrebuild,
    OpenPrebuildContext,
    Project,
} from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { LicenseEvaluator } from "@gitpod/licensor/lib";
import { Feature } from "@gitpod/licensor/lib/api";
import { ResponseError } from "vscode-jsonrpc";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { HostContextProvider } from "../../../src/auth/host-context-provider";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { UserCounter } from "../user/user-counter";
import { increasePrebuildsStartedCounter } from "../../../src/prometheus-metrics";
import { DeepPartial } from "@gitpod/gitpod-protocol/lib/util/deep-partial";
import { EntitlementService } from "../../../src/billing/entitlement-service";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { IncrementalPrebuildsService } from "../prebuilds/incremental-prebuilds-service";

@injectable()
export class WorkspaceFactoryEE extends WorkspaceFactory {
    @inject(LicenseEvaluator) protected readonly licenseEvaluator: LicenseEvaluator;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(UserCounter) protected readonly userCounter: UserCounter;
    @inject(EntitlementService) protected readonly entitlementService: EntitlementService;
    @inject(IncrementalPrebuildsService) protected readonly incrementalPrebuildsService: IncrementalPrebuildsService;

    @inject(UserDB) protected readonly userDB: UserDB;

    protected async requireEELicense(feature: Feature) {
        const cachedUserCount = this.userCounter.count;

        let userCount: number;
        if (cachedUserCount === null) {
            userCount = await this.userDB.getUserCount(true);
            this.userCounter.count = userCount;
        } else {
            userCount = cachedUserCount;
        }

        if (!this.licenseEvaluator.isEnabled(feature, userCount)) {
            throw new ResponseError(ErrorCodes.EE_LICENSE_REQUIRED, "enterprise license required");
        }
    }

    public async createForContext(
        ctx: TraceContext,
        user: User,
        project: Project | undefined,
        context: WorkspaceContext,
        normalizedContextURL: string,
    ): Promise<Workspace> {
        if (StartPrebuildContext.is(context)) {
            return this.createForStartPrebuild(ctx, user, context, normalizedContextURL);
        } else if (PrebuiltWorkspaceContext.is(context)) {
            return this.createForPrebuiltWorkspace(ctx, user, project, context, normalizedContextURL);
        }

        return super.createForContext(ctx, user, project, context, normalizedContextURL);
    }

    protected async createForStartPrebuild(
        ctx: TraceContext,
        user: User,
        context: StartPrebuildContext,
        normalizedContextURL: string,
    ): Promise<Workspace> {
        await this.requireEELicense(Feature.FeaturePrebuild);
        const span = TraceContext.startSpan("createForStartPrebuild", ctx);

        try {
            if (!CommitContext.is(context.actual)) {
                throw new Error("Can only prebuild workspaces with a commit context");
            }

            const { project, branch } = context;

            const commitContext: CommitContext = context.actual;

            const assertNoPrebuildIsRunningForSameCommit = async () => {
                const existingPWS = await this.db
                    .trace({ span })
                    .findPrebuiltWorkspaceByCommit(
                        commitContext.repository.cloneUrl,
                        CommitContext.computeHash(commitContext),
                    );
                if (!existingPWS) {
                    return;
                }
                log.debug("Found existing prebuild in createForStartPrebuild.", {
                    context,
                    cloneUrl: commitContext.repository.cloneUrl,
                    commit: CommitContext.computeHash(commitContext),
                });
                const wsInstance = await this.db.trace({ span }).findRunningInstance(existingPWS.buildWorkspaceId);
                if (wsInstance) {
                    throw new Error("A prebuild is already running for this commit.");
                }
            };

            await assertNoPrebuildIsRunningForSameCommit();

            const { config } = await this.configProvider.fetchConfig({ span }, user, context.actual);

            // If an incremental prebuild was requested, see if we can find a recent prebuild to act as a base.
            let ws;
            const recentPrebuild = await this.incrementalPrebuildsService.findGoodBaseForIncrementalBuild(
                commitContext,
                config,
                context,
                user,
            );
            if (recentPrebuild) {
                const loggedContext = filterForLogging(context);
                log.info({ userId: user.id }, "Using incremental prebuild base", {
                    basePrebuildId: recentPrebuild.id,
                    context: loggedContext,
                });

                const incrementalPrebuildContext: PrebuiltWorkspaceContext = {
                    title: `Incremental prebuild of "${commitContext.title}"`,
                    originalContext: commitContext,
                    prebuiltWorkspace: recentPrebuild,
                };

                // repeated assertion on prebuilds triggered for same commit here, in order to
                // reduce likelihood of duplicates if for instance handled by two different
                // server pods.
                await assertNoPrebuildIsRunningForSameCommit();

                ws = await this.createForPrebuiltWorkspace(
                    { span },
                    user,
                    project,
                    incrementalPrebuildContext,
                    normalizedContextURL,
                );
                // Overwrite the config from the parent prebuild:
                //   `createForPrebuiltWorkspace` 1:1 copies the config from the parent prebuild.
                //   Above, we've made sure that the parent's prebuild tasks (before/init/prebuild) are still the same as now.
                //   However, other non-prebuild config items might be outdated (e.g. any command task, VS Code extension, ...)
                //   To fix this, we overwrite the new prebuild's config with the most-recently fetched config.
                // See also: https://github.com/gitpod-io/gitpod/issues/7475
                //TODO(sven) doing side effects on objects back and forth is complicated and error-prone. We should rather make sure we pass in the config when creating the prebuiltWorkspace.
                ws.config = config;
            }

            // repeated assertion on prebuilds triggered for same commit here, in order to
            // reduce likelihood of duplicates if for instance handled by two different
            // server pods.
            await assertNoPrebuildIsRunningForSameCommit();

            if (!ws) {
                // No suitable parent prebuild was found -- create a (fresh) full prebuild.
                ws = await this.createForCommit({ span }, user, project, commitContext, normalizedContextURL);
            }
            ws.type = "prebuild";
            ws.projectId = project?.id;
            // Handle PVC propagation:
            if (!project?.settings?.usePersistentVolumeClaim) {
                if (ws.config._featureFlags) {
                    // If PVC is disabled, we want to make sure that we remove that feature flag (in case the user enabled it!)
                    // This is necessary to ensure if user has PVC enabled on their account, that they
                    // will not hijack prebuild with PVC and make everyone who use this prebuild to auto enroll into PVC feature.
                    ws.config._featureFlags = ws.config._featureFlags.filter((ff) => ff !== "persistent_volume_claim");
                }
            } else {
                // If PVC is enabled, we explicitly want all prebuilds to be stored that way.
                ws.config._featureFlags = (ws.config._featureFlags || []).concat(["persistent_volume_claim"]);
            }
            ws = await this.db.trace({ span }).store(ws);

            const pws = await this.db.trace({ span }).storePrebuiltWorkspace({
                id: uuidv4(),
                buildWorkspaceId: ws.id,
                cloneURL: commitContext.repository.cloneUrl,
                commit: CommitContext.computeHash(commitContext),
                state: "queued",
                creationTime: new Date().toISOString(),
                projectId: ws.projectId,
                branch,
                statusVersion: 0,
            });

            if (pws) {
                increasePrebuildsStartedCounter();
            }

            log.debug(
                { userId: user.id, workspaceId: ws.id },
                `Registered workspace prebuild: ${pws.id} for ${commitContext.repository.cloneUrl}:${commitContext.revision}`,
            );

            return ws;
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async createForPrebuiltWorkspace(
        ctx: TraceContext,
        user: User,
        project: Project | undefined,
        context: PrebuiltWorkspaceContext,
        normalizedContextURL: string,
    ): Promise<Workspace> {
        await this.requireEELicense(Feature.FeaturePrebuild);
        const span = TraceContext.startSpan("createForPrebuiltWorkspace", ctx);

        try {
            const buildWorkspaceID = context.prebuiltWorkspace.buildWorkspaceId;
            const buildWorkspace = await this.db.trace({ span }).findById(buildWorkspaceID);
            if (!buildWorkspace) {
                log.error(
                    { userId: user.id },
                    `No build workspace with ID ${buildWorkspaceID} found - falling back to original context`,
                );
                span.log({
                    error: `No build workspace with ID ${buildWorkspaceID} found - falling back to original context`,
                });
                return await this.createForContext(
                    { span },
                    user,
                    project,
                    context.originalContext,
                    normalizedContextURL,
                );
            }
            const config = { ...buildWorkspace.config };
            config.vscode = {
                extensions: (config && config.vscode && config.vscode.extensions) || [],
            };

            let projectId: string | undefined;
            // associate with a project, if it's the personal project of the current user
            if (project?.userId && project?.userId === user.id) {
                projectId = project.id;
            }
            // associate with a project, if the current user is a team member
            if (project?.teamId) {
                const teams = await this.teamDB.findTeamsByUser(user.id);
                if (teams.some((t) => t.id === project?.teamId)) {
                    projectId = project.id;
                }
            }

            // Special case for PVC: While it's a workspace-persisted feature flag, we support the upgrade path (non-pvc -> pvc), so we apply it here
            if (user.featureFlags?.permanentWSFeatureFlags?.includes("persistent_volume_claim")) {
                config._featureFlags = (config._featureFlags || []).concat(["persistent_volume_claim"]);
            }
            const billingTier = await this.entitlementService.getBillingTier(user);
            // this allows to control user`s PVC feature flag via ConfigCat
            if (
                await getExperimentsClientForBackend().getValueAsync("user_pvc", false, {
                    user,
                    billingTier,
                })
            ) {
                config._featureFlags = (config._featureFlags || []).concat(["persistent_volume_claim"]);
            }

            if (OpenPrebuildContext.is(context.originalContext)) {
                if (CommitContext.is(buildWorkspace.context)) {
                    if (
                        CommitContext.is(context.originalContext) &&
                        CommitContext.computeHash(context.originalContext) !==
                            CommitContext.computeHash(buildWorkspace.context)
                    ) {
                        // If the current context has a newer/different commit hash than the prebuild
                        // we force the checkout of the revision rather than the ref/branch.
                        // Otherwise we'd get the correct prebuild with the "wrong" Git ref.
                        delete buildWorkspace.context.ref;
                    }
                }

                // Because of incremental prebuilds, createForContext will take over the original context.
                // To ensure we get the right commit when forcing a prebuild, we force the context here.
                context.originalContext = buildWorkspace.context;
            }

            const id = await this.generateWorkspaceID(context);
            const newWs: Workspace = {
                id,
                type: "regular",
                creationTime: new Date().toISOString(),
                contextURL: normalizedContextURL,
                projectId,
                description: this.getDescription(context),
                ownerId: user.id,
                context: <WorkspaceContext & WithSnapshot & WithPrebuild>{
                    ...context.originalContext,
                    snapshotBucketId: context.prebuiltWorkspace.snapshot,
                    prebuildWorkspaceId: context.prebuiltWorkspace.id,
                    wasPrebuilt: true,
                },
                imageSource: buildWorkspace.imageSource,
                imageNameResolved: buildWorkspace.imageNameResolved,
                baseImageNameResolved: buildWorkspace.baseImageNameResolved,
                basedOnPrebuildId: context.prebuiltWorkspace.id,
                config,
            };
            await this.db.trace({ span }).store(newWs);
            return newWs;
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }
}

function filterForLogging(context: StartPrebuildContext) {
    return <DeepPartial<StartPrebuildContext>>{
        actual: context.actual,
        branch: context.branch,
        normalizedContextURL: context.normalizedContextURL,
        ref: context.ref,
        title: context.title,
        forceCreateNewWorkspace: context.forceCreateNewWorkspace,
        forceImageBuild: context.forceImageBuild,
        project: context.project,
        // placeholders for the actual history
        commitHistoryLength: context.commitHistory?.length || 0,
        additionalRepositoryCommitHistoriesLength: context.additionalRepositoryCommitHistories?.length || 0,
    };
}
