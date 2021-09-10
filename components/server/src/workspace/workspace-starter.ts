/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { CloneTargetMode, FileDownloadInitializer, GitAuthMethod, GitConfig, GitInitializer, PrebuildInitializer, SnapshotInitializer, WorkspaceInitializer } from "@gitpod/content-service/lib";
import { CompositeInitializer, FromBackupInitializer } from "@gitpod/content-service/lib/initializer_pb";
import { DBUser, DBWithTracing, TracedUserDB, TracedWorkspaceDB, UserDB, WorkspaceDB } from '@gitpod/gitpod-db/lib';
import { CommitContext, Disposable, GitpodToken, GitpodTokenType, IssueContext, NamedWorkspaceFeatureFlag, PullRequestContext, RefType, SnapshotContext, StartWorkspaceResult, User, UserEnvVar, UserEnvVarValue, WithEnvvarsContext, WithPrebuild, Workspace, WorkspaceContext, WorkspaceImageSource, WorkspaceImageSourceDocker, WorkspaceImageSourceReference, WorkspaceInstance, WorkspaceInstanceConfiguration, WorkspaceInstanceStatus, WorkspaceProbeContext, Permission, HeadlessWorkspaceEvent, HeadlessWorkspaceEventType, DisposableCollection, AdditionalContentContext, ImageConfigFile } from "@gitpod/gitpod-protocol";
import { IAnalyticsWriter } from '@gitpod/gitpod-protocol/lib/analytics';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { BuildRegistryAuth, BuildRegistryAuthSelective, BuildRegistryAuthTotal, BuildRequest, BuildResponse, BuildSource, BuildSourceDockerfile, BuildSourceReference, BuildStatus, ImageBuilderClientProvider, ResolveBaseImageRequest, ResolveWorkspaceImageRequest } from "@gitpod/image-builder/lib";
import { StartWorkspaceSpec, WorkspaceFeatureFlag } from "@gitpod/ws-manager/lib";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import { AdmissionLevel, EnvironmentVariable, GitSpec, PortSpec, PortVisibility, StartWorkspaceRequest, WorkspaceMetadata, WorkspaceType } from "@gitpod/ws-manager/lib/core_pb";
import * as crypto from 'crypto';
import { inject, injectable } from "inversify";
import * as uuidv4 from 'uuid/v4';
import { HostContextProvider } from "../auth/host-context-provider";
import { ScopedResourceGuard } from '../auth/resource-access';
import { Config } from "../config";
import { OneTimeSecretServer } from "../one-time-secret-server";
import { TheiaPluginService } from "../theia-plugin/theia-plugin-service";
import { AuthorizationService } from "../user/authorization-service";
import { TokenProvider } from "../user/token-provider";
import { UserService } from "../user/user-service";
import { ImageSourceProvider } from "./image-source-provider";
import { MessageBusIntegration } from "./messagebus-integration";
import * as path from 'path';
import { IDEConfig, IDEConfigService } from "../ide-config";

export interface StartWorkspaceOptions {
    rethrow?: boolean;
    forceDefaultImage?: boolean;
    excludeFeatureFlags?: NamedWorkspaceFeatureFlag[];
}

@injectable()
export class WorkspaceStarter {
    @inject(WorkspaceManagerClientProvider) protected readonly clientProvider: WorkspaceManagerClientProvider;
    @inject(Config) protected readonly config: Config;
    @inject(IDEConfigService) private readonly ideConfigService: IDEConfigService;
    @inject(TracedWorkspaceDB) protected readonly workspaceDb: DBWithTracing<WorkspaceDB>;
    @inject(TracedUserDB) protected readonly userDB: DBWithTracing<UserDB>;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(MessageBusIntegration) protected readonly messageBus: MessageBusIntegration;
    @inject(AuthorizationService) protected readonly authService: AuthorizationService;
    @inject(ImageBuilderClientProvider) protected readonly imagebuilderClientProvider: ImageBuilderClientProvider;
    @inject(ImageSourceProvider) protected readonly imageSourceProvider: ImageSourceProvider;
    @inject(UserService) protected readonly userService: UserService;
    @inject(IAnalyticsWriter) protected readonly analytics: IAnalyticsWriter;
    @inject(TheiaPluginService) protected readonly theiaService: TheiaPluginService;
    @inject(OneTimeSecretServer) protected readonly otsServer: OneTimeSecretServer;

    public async startWorkspace(ctx: TraceContext, workspace: Workspace, user: User, userEnvVars?: UserEnvVar[], options?: StartWorkspaceOptions): Promise<StartWorkspaceResult> {
        const span = TraceContext.startSpan("WorkspaceStarter.startWorkspace", ctx);

        options = options || {};
        try {
            // Some workspaces do not have an image source.
            // Workspaces without image source are not only legacy, but also happened due to what looks like a bug.
            // Whenever a such a workspace is re-started we'll give it an image source now. This is in line with how this thing used to work.
            //
            // At this point any workspace that has no imageSource should have a commit context (we don't have any other contexts which don't resolve
            // to a commit context prior to being started, or which don't get an imageSource).
            if (!workspace.imageSource) {
                const imageSource = await this.imageSourceProvider.getImageSource(ctx, user, workspace.context as CommitContext, workspace.config);
                log.debug('Found workspace without imageSource, generated one', { imageSource });

                workspace.imageSource = imageSource;
                await this.workspaceDb.trace({ span }).store(workspace);
            }

            if (options.forceDefaultImage) {
                const req = new ResolveBaseImageRequest();
                req.setRef(this.config.workspaceDefaults.workspaceImage);
                const allowAll = new BuildRegistryAuthTotal();
                allowAll.setAllowAll(true);
                const auth = new BuildRegistryAuth();
                auth.setTotal(allowAll);
                req.setAuth(auth);

                const client = this.imagebuilderClientProvider.getDefault();
                const res = await client.resolveBaseImage({span}, req);
                workspace.imageSource = <WorkspaceImageSourceReference>{
                  baseImageResolved: res.getRef()
                }
            }

            // check if there has been an instance before, i.e. if this is a restart
            const pastInstances = await this.workspaceDb.trace({ span }).findInstances(workspace.id);
            const mustHaveBackup = pastInstances.some(i => !!i.status && !!i.status.conditions && !i.status.conditions.failed);

            const ideConfig = await this.ideConfigService.config;

            // create and store instance
            let instance = await this.workspaceDb.trace({ span }).storeInstance(await this.newInstance(workspace, user, options.excludeFeatureFlags || [], ideConfig));
            span.log({ "newInstance": instance.id });

            const forceRebuild = !!workspace.context.forceImageBuild;

            let needsImageBuild: boolean;
            try {
                // if we need to build the workspace image we musn't wait for actuallyStartWorkspace to return as that would block the
                // frontend until the image is built.
                needsImageBuild = forceRebuild || await this.needsImageBuild({ span }, user, workspace, instance);
                if (needsImageBuild) {
                    instance.status.conditions = {
                        neededImageBuild: true,
                    };
                }
                span.setTag("needsImageBuild", needsImageBuild);
            } catch (err) {
                // if we fail to check if the workspace needs an image build (e.g. becuase the image builder is unavailable),
                // we must properly fail the workspace instance, i.e. set its status to stopped, deal with prebuilds etc.
                //
                // Once we've reached actuallyStartWorkspace that function will take care of failing the instance.
                await this.failInstanceStart({ span }, err, workspace, instance);
                throw err
            }

            // If the caller requested that errors be rethrown we must await the actual workspace start to be in the exception path.
            // To this end we disable the needsImageBuild behaviour if rethrow is true.
            if (needsImageBuild && !options.rethrow) {
                this.actuallyStartWorkspace({ span }, instance, workspace, user, mustHaveBackup, ideConfig, userEnvVars, options.rethrow, forceRebuild);
                return { instanceID: instance.id };
            }

            return await this.actuallyStartWorkspace({ span }, instance, workspace, user, mustHaveBackup, ideConfig, userEnvVars, options.rethrow, forceRebuild);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    // Note: this function does not expect to be awaited for by its caller. This means that it takes care of error handling itself
    //       and creates its tracing span as followFrom rather than the usual childOf reference.
    protected async actuallyStartWorkspace(ctx: TraceContext, instance: WorkspaceInstance, workspace: Workspace, user: User, mustHaveBackup: boolean, ideConfig: IDEConfig, userEnvVars?: UserEnvVar[], rethrow?: boolean, forceRebuild?: boolean): Promise<StartWorkspaceResult> {
        const span = TraceContext.startAsyncSpan("actuallyStartWorkspace", ctx);

        try {
            // build workspace image
            instance = await this.buildWorkspaceImage({ span }, user, workspace, instance, forceRebuild, forceRebuild);

            let type: WorkspaceType = WorkspaceType.REGULAR;
            if (workspace.type === 'prebuild') {
                type = WorkspaceType.PREBUILD;
            } else if (workspace.type === 'probe') {
                type = WorkspaceType.PROBE;
            }

            // create spec
            const spec = await this.createSpec({span}, user, workspace, instance, mustHaveBackup, ideConfig, userEnvVars);

            // create start workspace request
            const metadata = new WorkspaceMetadata();
            metadata.setOwner(workspace.ownerId);
            metadata.setMetaId(workspace.id);
            const startRequest = new StartWorkspaceRequest();
            startRequest.setId(instance.id);
            startRequest.setMetadata(metadata);
            startRequest.setType(type);
            startRequest.setSpec(spec);
            startRequest.setServicePrefix(workspace.id);

            // tell the world we're starting this instance
            const { manager, installation } = await this.clientProvider.getStartManager(user, workspace, instance);
            instance.status.phase = "pending";
            instance.region = installation;
            await this.workspaceDb.trace({ span }).storeInstance(instance);
            try {
                await this.messageBus.notifyOnInstanceUpdate(workspace.ownerId, instance);
            } catch (err) {
                // if sending the notification fails that's no reason to stop the workspace creation.
                // If the dashboard misses this event it will catch up at the next one.
                span.log({ "notifyOnInstanceUpdate.error": err });
                log.warn("cannot send instance update - this should be mostly inconsequential", err);
            }

            // start that thing
            const resp = (await manager.startWorkspace({ span }, startRequest)).toObject();
            span.log({ "resp": resp });

            this.analytics.track({
                userId: user.id,
                event: "workspace-started",
                properties: {
                    workspaceId: workspace.id,
                    instanceId: instance.id,
                    contextURL: workspace.contextURL,
                    usesPrebuild: spec.getInitializer()?.hasPrebuild(),
                }
            });

            {
                if (type === WorkspaceType.PREBUILD) {
                    // do not await
                    this.notifyOnPrebuildQueued(ctx, workspace.id).catch(err => {
                        log.error("failed to notify on prebuild queued", err);
                    });
                }
            }

            return { instanceID: instance.id, workspaceURL: resp.url };
        } catch (err) {
            TraceContext.logError({ span }, err);
            await this.failInstanceStart({ span }, err, workspace, instance);

            if (rethrow) {
                throw err;
            } else {
                // we "swallow" this error as the promise of this function might not be awaited to - and even so,
                // we've already handled the error properly.
            }

            return { instanceID: instance.id };
        } finally {
            span.finish();
        }
    }

    protected async notifyOnPrebuildQueued(ctx: TraceContext, workspaceId: string) {
        const span = TraceContext.startAsyncSpan("notifyOnPrebuildQueued", ctx);
        const prebuild = await this.workspaceDb.trace({span}).findPrebuildByWorkspaceID(workspaceId);
        if (prebuild) {
            const info = (await this.workspaceDb.trace({span}).findPrebuildInfos([prebuild.id]))[0];
            if (info) {
                this.messageBus.notifyOnPrebuildUpdate({ info, status: "queued" });
            }
        }
    }

    /**
     * failInstanceStart properly fails a workspace instance if something goes wrong before the instance ever reaches
     * workspace manager. In this case we need to make sure we also fulfil the tasks of the bridge (e.g. for prebulds).
     */
    protected async failInstanceStart(ctx: TraceContext, err: Error, workspace: Workspace, instance: WorkspaceInstance) {
        const span = TraceContext.startAsyncSpan("failInstanceStart", ctx);

        try {
            // We may have never actually started the workspace which means that ws-manager-bridge never set a workspace status.
            // We have to set that status ourselves.
            instance.status.phase = 'stopped';
            instance.stoppingTime = new Date().toISOString();
            instance.stoppedTime = new Date().toISOString();

            instance.status.conditions.failed = err.toString();
            instance.status.message = `Workspace cannot be started: ${err}`;
            await this.workspaceDb.trace({ span }).storeInstance(instance);
            await this.messageBus.notifyOnInstanceUpdate(workspace.ownerId, instance);

            // If we just attempted to start a workspace for a prebuild - and that failed, we have to fail the prebuild itself.
            if (workspace.type === 'prebuild') {
                const prebuild = await this.workspaceDb.trace({span}).findPrebuildByWorkspaceID(workspace.id);
                if (prebuild && prebuild.state !== 'aborted') {
                    prebuild.state = "aborted";
                    prebuild.error = err.toString();

                    await this.workspaceDb.trace({ span }).storePrebuiltWorkspace(prebuild)
                    await this.messageBus.notifyHeadlessUpdate({span}, workspace.ownerId, workspace.id, <HeadlessWorkspaceEvent>{
                        type: HeadlessWorkspaceEventType.Aborted,
                    });
                }
            }
        } catch (err) {
            TraceContext.logError({span}, err);
            log.error({workspaceId: workspace.id, instanceId: instance.id, userId: workspace.ownerId}, "cannot properly fail workspace instance during start", err);
        }
    }

    /**
     * Creates a new instance for a given workspace and its owner
     *
     * @param workspace the workspace to create an instance for
     */
    protected async newInstance(workspace: Workspace, user: User, excludeFeatureFlags: NamedWorkspaceFeatureFlag[], ideConfig: IDEConfig): Promise<WorkspaceInstance> {
        // TODO(cw): once we allow changing the IDE in the workspace config (i.e. .gitpod.yml), we must
        //           give that value precedence over the default choice.
        const configuration: WorkspaceInstanceConfiguration = {
            theiaVersion: ideConfig.ideVersion,
            ideImage: ideConfig.ideImage,
        };

        const ideChoice = user.additionalData?.ideSettings?.defaultIde;
        if (!!ideChoice) {
            const mappedImage = ideConfig.ideImageAliases[ideChoice];
            if (!!mappedImage) {
                configuration.ideImage = mappedImage;
            } else if (this.authService.hasPermission(user, "ide-settings")) {
                // if the IDE choice isn't one of the preconfiured choices, we assume its the image name.
                // For now, this feature requires special permissions.
                configuration.ideImage = ideChoice;
            }
        }

        let featureFlags: NamedWorkspaceFeatureFlag[] = workspace.config._featureFlags || [];
        featureFlags = featureFlags.concat(this.config.workspaceDefaults.defaultFeatureFlags);
        if (user.featureFlags && user.featureFlags.permanentWSFeatureFlags) {
            featureFlags = featureFlags.concat(featureFlags, user.featureFlags.permanentWSFeatureFlags);
        }

        // if the user has feature preview enabled, we need to add the respective feature flags.
        // Beware: all feature flags we add here are not workspace-persistent feature flags, e.g. no full-workspace backup.
        if (!!user.additionalData?.featurePreview) {
            featureFlags = featureFlags.concat(this.config.workspaceDefaults.previewFeatureFlags.filter(f => !featureFlags.includes(f)));
        }

        featureFlags = featureFlags.filter(f => !excludeFeatureFlags.includes(f));

        if (!!featureFlags) {
            // only set feature flags if there actually are any. Otherwise we waste the
            // few bytes of JSON in the database for no good reason.
            configuration.featureFlags = featureFlags;
        }

        const now = new Date().toISOString();
        const instance: WorkspaceInstance = {
            id: uuidv4(),
            workspaceId: workspace.id,
            creationTime: now,
            ideUrl: '', // Initially empty, filled during starting process
            region: this.config.installationShortname, // Shortname set to bridge can cleanup workspaces stuck preparing
            workspaceImage: '', // Initially empty, filled during starting process
            status: {
                conditions: {},
                phase: 'unknown',
            },
            configuration
        }
        return instance;
    }

    protected async prepareBuildRequest(ctx: TraceContext, workspace: Workspace, imgsrc: WorkspaceImageSource, user: User, ignoreBaseImageresolvedAndRebuildBase: boolean = false): Promise<{src: BuildSource, auth: BuildRegistryAuth, disposable?: Disposable}> {
        const span = TraceContext.startAsyncSpan("prepareBuildRequest", ctx);

        try {
            // if our workspace ever had its base image built, we do not want to build it again. In this case we use a build source reference
            // and dismiss the original image source.
            if (workspace.baseImageNameResolved && !ignoreBaseImageresolvedAndRebuildBase) {
                span.setTag("hasBaseImageNameResolved", true);
                span.log({"baseImageNameResolved": workspace.baseImageNameResolved});

                const ref = new BuildSourceReference();
                ref.setRef(workspace.baseImageNameResolved);

                const src = new BuildSource();
                src.setRef(ref);

                // It doesn't matter what registries the user has access to at this point.
                // All they need access to is the base image repository, as we're building the Gitpod layer only.
                const nauth = new BuildRegistryAuthSelective();
                nauth.setAllowBaserep(true);
                // The base image is not neccesarily stored on the Gitpod registry, but might also come
                // from a private whitelisted registry also. Hence allowBaserep is not enough, and we also
                // need to explicitly allow all whitelisted registry when resolving the base image.
                nauth.setAnyOfList(this.config.defaultBaseImageRegistryWhitelist);
                const auth = new BuildRegistryAuth();
                auth.setSelective(nauth);

                return {src, auth};
            }

            const auth = new BuildRegistryAuth();
            const userHasRegistryAccess = this.authService.hasPermission(user, Permission.REGISTRY_ACCESS);
            if (userHasRegistryAccess) {
                const totalAuth = new BuildRegistryAuthTotal();
                totalAuth.setAllowAll(userHasRegistryAccess);
                auth.setTotal(totalAuth);
            } else {
                const selectiveAuth = new BuildRegistryAuthSelective();
                selectiveAuth.setAnyOfList(this.config.defaultBaseImageRegistryWhitelist);
                auth.setSelective(selectiveAuth);
            }
            if (WorkspaceImageSourceDocker.is(imgsrc)) {
                let source: WorkspaceInitializer;
                const disp = new DisposableCollection();
                let checkoutLocation = this.getCheckoutLocation(workspace);
                if (!AdditionalContentContext.hasDockerConfig(workspace.context, workspace.config) && imgsrc.dockerFileSource) {
                    // TODO(se): we cannot change this initializer structure now because it is part of how baserefs are computed in image-builder.
                    // Image builds should however just use the initialization if the workspace they are running for (i.e. the one from above).
                    const { git, disposable } = await this.createGitInitializer({span}, workspace, {
                        ...imgsrc.dockerFileSource,
                        title: "irrelevant",
                        ref: undefined,
                    }, user);
                    disp.push(disposable);
                    git.setCloneTaget(imgsrc.dockerFileSource.revision);
                    git.setTargetMode(CloneTargetMode.REMOTE_COMMIT);
                    checkoutLocation = "."
                    git.setCheckoutLocation(checkoutLocation);
                    source = new WorkspaceInitializer();
                    source.setGit(git);
                } else {
                    const {initializer, disposable} = await this.createInitializer({span}, workspace, workspace.context, user, false);
                    source = initializer;
                    disp.push(disposable);
                }

                const context = (workspace.config.image as ImageConfigFile).context;
                const contextPath = !!context ? path.join(checkoutLocation, context) : checkoutLocation;
                const dockerFilePath = path.join(checkoutLocation, imgsrc.dockerFilePath);

                const file = new BuildSourceDockerfile();
                file.setContextPath(contextPath);
                file.setDockerfilePath(dockerFilePath);
                file.setSource(source);
                file.setDockerfileVersion(imgsrc.dockerFileHash);

                const src = new BuildSource();
                src.setFile(file);
                return {src, auth, disposable: disp};
            }
            if (WorkspaceImageSourceReference.is(imgsrc)) {
                const ref = new BuildSourceReference();
                ref.setRef(imgsrc.baseImageResolved);

                const src = new BuildSource();
                src.setRef(ref);
                return {src, auth};
            }

            throw new Error("unknown workspace image source");
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish()
        }
    }

    protected async needsImageBuild(ctx: TraceContext, user: User, workspace: Workspace, instance: WorkspaceInstance): Promise<boolean> {
        const span = TraceContext.startSpan("needsImageBuild", ctx);
        try {
            const client = this.imagebuilderClientProvider.getDefault();
            const {src, auth, disposable} = await this.prepareBuildRequest({ span }, workspace, workspace.imageSource!, user);

            const req = new ResolveWorkspaceImageRequest();
            req.setSource(src);
            req.setAuth(auth);
            const result = await client.resolveWorkspaceImage({ span }, req)

            if (!!disposable) {
                disposable.dispose();
            }

            return result.getStatus() != BuildStatus.DONE_SUCCESS;
        } catch (err) {
            TraceContext.logError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected async buildWorkspaceImage(ctx: TraceContext, user: User, workspace: Workspace, instance: WorkspaceInstance, ignoreBaseImageresolvedAndRebuildBase: boolean = false, forceRebuild: boolean = false): Promise<WorkspaceInstance> {
        const span = TraceContext.startSpan("buildWorkspaceImage", ctx);

        try {
            // Start build...
            const client = this.imagebuilderClientProvider.getDefault();
            const {src, auth, disposable} = await this.prepareBuildRequest({ span }, workspace, workspace.imageSource!, user, ignoreBaseImageresolvedAndRebuildBase || forceRebuild);

            const req = new BuildRequest();
            req.setSource(src);
            req.setAuth(auth);
            req.setForcerebuild(forceRebuild);

            const result = await client.build({ span }, req);

            // Update the workspace now that we know what the name of the workspace image will be (which doubles as buildID)
            workspace.imageNameResolved = result.ref;
            span.log({"ref": workspace.imageNameResolved});
            await this.workspaceDb.trace({ span }).store(workspace);

            // Update workspace instance to tell the world we're building an image
            const workspaceImage = result.ref;
            const status: WorkspaceInstanceStatus = result.actuallyNeedsBuild ? { ...instance.status, phase: 'preparing' } : instance.status;
            instance = await this.workspaceDb.trace({ span }).updateInstancePartial(instance.id, { workspaceImage, status });
            await this.messageBus.notifyOnInstanceUpdate(workspace.ownerId, instance);

            let buildResult: BuildResponse;
            try {
                // ...and wait for the build to finish
                buildResult = await result.buildPromise;
                if (buildResult.getStatus() == BuildStatus.DONE_FAILURE) {
                    throw new Error(buildResult.getMessage());
                }
            } catch (err) {
                if (err && err.message && err.message.includes("base image does not exist") && !ignoreBaseImageresolvedAndRebuildBase) {
                    // we've attempted to add the base layer for a workspace whoose base image has gone missing.
                    // Ignore the previously built (now missing) base image and force a rebuild.
                    return this.buildWorkspaceImage(ctx, user, workspace, instance, true, forceRebuild);
                } else {
                    throw err;
                }
            } finally {
                // clean any created one time secrets, so they don't hang around unnecessarily
                if (!!disposable) {
                    disposable.dispose();
                }
            }

            // We have just found out how our base image is called - remember that.
            // Note: it's intentional that we overwrite existing baseImageNameResolved values here so that one by one the refs here become absolute (i.e. digested form).
            //       This prevents the "rebuilds" for old workspaces.
            if (!!buildResult.getBaseRef() && buildResult.getBaseRef() != workspace.baseImageNameResolved) {
                span.log({"oldBaseRef": workspace.baseImageNameResolved, "newBaseRef": buildResult.getBaseRef()});

                workspace.baseImageNameResolved = buildResult.getBaseRef();
                await this.workspaceDb.trace({ span }).store(workspace);
            }

            return instance;
        } catch (err) {
            // Notify error
            let message = 'Error building image!';
            if (err && err.message) {
                message = err.message;
            }

            instance = await this.workspaceDb.trace({ span }).updateInstancePartial(instance.id, { status: { ...instance.status, phase: 'preparing', conditions: { failed: message }, message } });
            await this.messageBus.notifyOnInstanceUpdate(workspace.ownerId, instance);

            TraceContext.logError({ span }, err);
            log.error({instanceId: instance.id, userId: user.id, workspaceId: workspace.id}, `workspace image build failed: ${message}`);
            this.analytics.track({ userId: user.id, event: "imagebuild-failed", properties: { workspaceId: workspace.id, instanceId: instance.id, contextURL: workspace.contextURL, }});

            throw err;
        } finally {
            span.finish();
        }
    }

    protected async createSpec(traceCtx: TraceContext, user: User, workspace: Workspace, instance: WorkspaceInstance, mustHaveBackup: boolean, ideConfig: IDEConfig, userEnvVars?: UserEnvVarValue[]): Promise<StartWorkspaceSpec> {
        const context = workspace.context;

        let allEnvVars: UserEnvVarValue[] = [];
        if (userEnvVars) {
            allEnvVars = allEnvVars.concat(userEnvVars);
        }
        if (WithEnvvarsContext.is(context)) {
            allEnvVars = allEnvVars.concat(context.envvars);
        }
        if (CommitContext.is(context)) {
            // this is a commit context, thus we can filter the env vars
            allEnvVars = UserEnvVar.filter(allEnvVars, context.repository.owner, context.repository.name);
        }
        const envvars = allEnvVars.map(uv => {
            const ev = new EnvironmentVariable();
            ev.setName(uv.name);
            ev.setValue(uv.value);
            return ev;
        });

        const ideAlias = user.additionalData?.ideSettings?.defaultIde;
        if (ideAlias && ideConfig.ideImageAliases[ideAlias]) {
            const ideAliasEnv = new EnvironmentVariable();
            ideAliasEnv.setName('GITPOD_IDE_ALIAS');
            ideAliasEnv.setValue(ideAlias);
            envvars.push(ideAliasEnv);
        }

        const contextUrlEnv = new EnvironmentVariable();
        contextUrlEnv.setName('GITPOD_WORKSPACE_CONTEXT_URL');
        contextUrlEnv.setValue(workspace.contextURL);
        envvars.push(contextUrlEnv);

        const contextEnv = new EnvironmentVariable();
        contextEnv.setName('GITPOD_WORKSPACE_CONTEXT');
        contextEnv.setValue(JSON.stringify(workspace.context));
        envvars.push(contextEnv);

        log.debug("Workspace config", workspace.config)
        if (!!workspace.config.tasks) {
            // The task config is interpreted by Theia only, there's little point in transforming it into something
            // wsman understands and back into the very same structure.
            const ev = new EnvironmentVariable();
            ev.setName("GITPOD_TASKS");
            ev.setValue(JSON.stringify(workspace.config.tasks));
            envvars.push(ev);
        }
        const addExtensionsToEnvvarPromise = this.theiaService.resolvePlugins(user.id, { config: workspace.config }).then(
            result => {
                if (result) {
                    const resolvedExtensions = new EnvironmentVariable();
                    resolvedExtensions.setName("GITPOD_RESOLVED_EXTENSIONS");
                    resolvedExtensions.setValue(JSON.stringify(result.resolved));
                    envvars.push(resolvedExtensions);

                    const externalExtensions = new EnvironmentVariable();
                    externalExtensions.setName("GITPOD_EXTERNAL_EXTENSIONS");
                    externalExtensions.setValue(JSON.stringify(result.external));
                    envvars.push(externalExtensions);
                }
            }
        )

        const vsxRegistryUrl = new EnvironmentVariable();
        vsxRegistryUrl.setName("VSX_REGISTRY_URL");
        vsxRegistryUrl.setValue(this.config.vsxRegistryUrl);
        envvars.push(vsxRegistryUrl);

        const createGitpodTokenPromise = (async () => {
            const scopes = this.createDefaultGitpodAPITokenScopes(workspace, instance);
            const token = crypto.randomBytes(30).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest("hex");
            const dbToken: GitpodToken & { user: DBUser } = {
                tokenHash,
                name: `${instance.id}-default`,
                type: GitpodTokenType.MACHINE_AUTH_TOKEN,
                user: user as DBUser,
                scopes,
                created: new Date().toISOString(),
            };
            await this.userDB.trace(traceCtx).storeGitpodToken(dbToken);

            const otsExpirationTime = new Date();
            otsExpirationTime.setMinutes(otsExpirationTime.getMinutes() + 30);
            const tokenExpirationTime = new Date();
            tokenExpirationTime.setMinutes(tokenExpirationTime.getMinutes() + (24 * 60));
            const ots = await this.otsServer.serve(traceCtx, token, otsExpirationTime);

            const ev = new EnvironmentVariable();
            ev.setName("THEIA_SUPERVISOR_TOKENS");
            ev.setValue(JSON.stringify([{
                tokenOTS: ots.token,
                token: "ots",
                kind: "gitpod",
                host: this.config.hostUrl.url.host,
                scope: scopes,
                expiryDate: tokenExpirationTime.toISOString(),
                reuse: 2
            }]));
            envvars.push(ev);
        })();

        const portIndex = new Set<number>();
        const ports = (workspace.config.ports || []).map(p => {
            if (portIndex.has(p.port)) {
                log.debug({instanceId: instance.id, workspaceId: workspace.id, userId: user.id}, `duplicate port in user config: ${p.port}`);
                return undefined;
            }
            portIndex.add(p.port);

            const spec = new PortSpec();
            let target = p.port;

            spec.setPort(p.port);
            spec.setTarget(target);
            spec.setVisibility(p.visibility == 'public' ? PortVisibility.PORT_VISIBILITY_PUBLIC : PortVisibility.PORT_VISIBILITY_PRIVATE);
            return spec;
        }).filter(spec => !!spec) as PortSpec[];

        let admissionLevel: AdmissionLevel;
        if (workspace.shareable) {
            admissionLevel = AdmissionLevel.ADMIT_EVERYONE;
        } else {
            admissionLevel = AdmissionLevel.ADMIT_OWNER_ONLY;
        }

        let checkoutLocation = workspace.config.checkoutLocation;
        if (!checkoutLocation) {
            if (CommitContext.is(context)) {
                checkoutLocation = context.repository.name;
            } else {
                checkoutLocation = ".";
            }
        }
        const initializerPromise = this.createInitializer(traceCtx, workspace, workspace.context, user, mustHaveBackup);
        const userTimeoutPromise = this.userService.getDefaultWorkspaceTimeout(user);

        const featureFlags = instance.configuration!.featureFlags || [];

        let ideImage: string;
        if (!!instance.configuration?.ideImage) {
            ideImage = instance.configuration?.ideImage;
        } else {
            ideImage = ideConfig.ideImage;
        }

        const spec = new StartWorkspaceSpec();
        spec.setCheckoutLocation(checkoutLocation!);
        await addExtensionsToEnvvarPromise;
        await createGitpodTokenPromise;
        spec.setEnvvarsList(envvars);
        spec.setGit(this.createGitSpec(workspace, user));
        spec.setPortsList(ports);
        spec.setInitializer((await initializerPromise).initializer);
        spec.setIdeImage(ideImage);
        spec.setWorkspaceImage(instance.workspaceImage);
        spec.setWorkspaceLocation(workspace.config.workspaceLocation || spec.getCheckoutLocation());
        spec.setFeatureFlagsList(this.toWorkspaceFeatureFlags(featureFlags));
        if (workspace.type === 'regular') {
            spec.setTimeout(await userTimeoutPromise);
        }
        spec.setAdmission(admissionLevel);
        return spec;
    }

    protected createDefaultGitpodAPITokenScopes(workspace: Workspace, instance: WorkspaceInstance): string[] {
        const scopes = [
            "function:getWorkspace",
            "function:getLoggedInUser",
            "function:getPortAuthenticationToken",
            "function:getWorkspaceOwner",
            "function:getWorkspaceUsers",
            "function:isWorkspaceOwner",
            "function:controlAdmission",
            "function:setWorkspaceTimeout",
            "function:getWorkspaceTimeout",
            "function:sendHeartBeat",
            "function:getOpenPorts",
            "function:openPort",
            "function:closePort",
            "function:getLayout",
            "function:generateNewGitpodToken",
            "function:takeSnapshot",
            "function:storeLayout",
            "function:stopWorkspace",
            "function:getToken",
            "function:getGitpodTokenScopes",
            "function:getContentBlobUploadUrl",
            "function:getContentBlobDownloadUrl",
            "function:accessCodeSyncStorage",
            "function:guessGitTokenScopes",
            "function:getEnvVars",
            "function:setEnvVar",
            "function:deleteEnvVar",
            "function:trackEvent",

            "resource:"+ScopedResourceGuard.marshalResourceScope({kind: "workspace", subjectID: workspace.id, operations: ["get", "update"]}),
            "resource:"+ScopedResourceGuard.marshalResourceScope({kind: "workspaceInstance", subjectID: instance.id, operations: ["get", "update", "delete"]}),
            "resource:"+ScopedResourceGuard.marshalResourceScope({kind: "snapshot", subjectID: ScopedResourceGuard.SNAPSHOT_WORKSPACE_SUBJECT_ID_PREFIX + workspace.id, operations: ["create"]}),
            "resource:"+ScopedResourceGuard.marshalResourceScope({kind: "gitpodToken", subjectID: "*", operations: ["create"]}),
            "resource:"+ScopedResourceGuard.marshalResourceScope({kind: "userStorage", subjectID: "*", operations: ["create", "get", "update"]}),
            "resource:"+ScopedResourceGuard.marshalResourceScope({kind: "token", subjectID: "*", operations: ["get"]}),
            "resource:"+ScopedResourceGuard.marshalResourceScope({kind: "contentBlob", subjectID: "*", operations: ["create", "get"]}),
        ];
        if (CommitContext.is(workspace.context)) {
            const subjectID = workspace.context.repository.owner + '/' + workspace.context.repository.name;
            scopes.push(
                "resource:"+ScopedResourceGuard.marshalResourceScope({kind: "envVar", subjectID, operations: ["create", "get", "update", "delete"]}),
            );
        }
        return scopes;
    }

    protected createGitSpec(workspace: Workspace, user: User): GitSpec {
        const context = workspace.context;
        if (!CommitContext.is(context)) {
            // this is not a commit context, thus we cannot produce a sensible GitSpec
            return new GitSpec();
        }

        const host = context.repository.host;
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext) {
            throw new Error(`Cannot authorize with host: ${host}`);
        }
        const authProviderId = hostContext.authProvider.authProviderId;
        const identity = User.getIdentity(user, authProviderId);
        if (!identity) {
            throw new Error("User is unauthorized!");
        }

        const gitSpec = new GitSpec();
        gitSpec.setUsername(user.fullName || identity.authName);
        gitSpec.setEmail(identity.primaryEmail!);
        return gitSpec;
    }

    protected async createInitializer(traceCtx: TraceContext, workspace: Workspace, context: WorkspaceContext, user: User, mustHaveBackup: boolean): Promise<{initializer: WorkspaceInitializer, disposable: Disposable}> {
        let result = new WorkspaceInitializer();
        const disp = new DisposableCollection();

        if (mustHaveBackup) {
            result.setBackup(new FromBackupInitializer());
        } else if (SnapshotContext.is(context)) {
            const snapshot = new SnapshotInitializer();
            snapshot.setSnapshot(context.snapshotBucketId);
            result.setSnapshot(snapshot);
        } else if (WithPrebuild.is(context)) {
            if (!CommitContext.is(context)) {
                throw new Error("context is not a commit context");
            }

            const snapshot = new SnapshotInitializer();
            snapshot.setSnapshot(context.snapshotBucketId);
            const { git } = await this.createGitInitializer(traceCtx, workspace, context, user);
            const init = new PrebuildInitializer();
            init.setPrebuild(snapshot);
            init.setGit(git);
            result.setPrebuild(init);
        } else if (WorkspaceProbeContext.is(context)) {
            // workspace probes have no workspace initializer as they need no content
        } else if (CommitContext.is(context)) {
            const { git, disposable } = await this.createGitInitializer(traceCtx, workspace, context, user);
            disp.push(disposable);
            result.setGit(git);
        } else {
            throw new Error("cannot create initializer for unkown context type");
        }
        if (AdditionalContentContext.is(context)) {
            const additionalInit =  new FileDownloadInitializer();

            const getDigest = (contents: string) => {
                return 'sha256:'+crypto.createHash('sha256').update(contents).digest('hex');
            }

            const tokenExpirationTime = new Date();
            tokenExpirationTime.setMinutes(tokenExpirationTime.getMinutes() + 30);
            const fileInfos = await Promise.all(Object.entries(context.additionalFiles).map(async ([filePath, content]) => {
                const url = await this.otsServer.serve(traceCtx, content, tokenExpirationTime);
                const finfo = new FileDownloadInitializer.FileInfo();
                finfo.setUrl(url.token);
                finfo.setFilePath(filePath);
                finfo.setDigest(getDigest(content))
                return finfo;
            }));

            additionalInit.setFilesList(fileInfos);
            additionalInit.setTargetLocation(this.getCheckoutLocation(workspace));

            // wire the protobuf structure
            const newRoot = new WorkspaceInitializer();
            const composite = new CompositeInitializer();
            newRoot.setComposite(composite);
            composite.addInitializer(result);
            const wsInitializerForDownload = new WorkspaceInitializer();
            wsInitializerForDownload.setDownload(additionalInit);
            composite.addInitializer(wsInitializerForDownload);
            result = newRoot;
        }
        return {initializer: result, disposable: disp};
    }

    protected async createGitInitializer(traceCtx: TraceContext, workspace: Workspace, context: CommitContext, user: User): Promise<{git: GitInitializer, disposable: Disposable}> {
        if (!CommitContext.is(context)) {
            throw new Error("Unknown workspace context");
        }
        const host = context.repository.host;
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext) {
            throw new Error(`Cannot authorize with host: ${host}`);
        }
        const authProviderId = hostContext.authProvider.authProviderId;
        const identity = user.identities.find(i => i.authProviderId === authProviderId);
        if (!identity) {
            throw new Error("User is unauthorized!");
        }

        const tokenExpirationTime = new Date();
        tokenExpirationTime.setMinutes(tokenExpirationTime.getMinutes() + 30);
        let tokenOTS: string | undefined;
        let disposable: Disposable | undefined;
        try {
            const token = await this.tokenProvider.getTokenForHost(user, host);
            const username = token.username || "oauth2";
            const res = await this.otsServer.serve(traceCtx, `${username}:${token.value}`, tokenExpirationTime);
            tokenOTS = res.token;
            disposable = res.disposable;
        } catch (error) { // no token
            log.error({workspaceId: workspace.id, userId: workspace.ownerId}, "cannot authenticate user for Git initializer", error);
            throw new Error("User is unauthorized!");
        }
        const cloneUrl = context.repository.cloneUrl || context.cloneUrl!;

        var cloneTarget: string | undefined;
        var targetMode: CloneTargetMode;
        const localBranchName = IssueContext.is(context) ? context.localBranch : undefined;
        if (localBranchName) {
            targetMode = CloneTargetMode.LOCAL_BRANCH;
            cloneTarget = localBranchName;
        } else if (RefType.getRefType(context) === 'tag') {
            targetMode = CloneTargetMode.REMOTE_COMMIT;
            cloneTarget = context.revision;
        } else if (context.ref) {
            targetMode = CloneTargetMode.REMOTE_BRANCH;
            cloneTarget = context.ref;
        } else if (context.revision) {
            targetMode = CloneTargetMode.REMOTE_COMMIT;
            cloneTarget = context.revision;
        } else {
            targetMode = CloneTargetMode.REMOTE_HEAD;
        }

        const upstreamRemoteURI = this.buildUpstreamCloneUrl(context);

        const gitConfig = new GitConfig();
        gitConfig.setAuthentication(GitAuthMethod.BASIC_AUTH_OTS);
        gitConfig.setAuthOts(tokenOTS);

        if (this.config.insecureNoDomain) {
            const token = await this.tokenProvider.getTokenForHost(user, host);
            gitConfig.setAuthentication(GitAuthMethod.BASIC_AUTH);
            gitConfig.setAuthUser(token.username || "oauth2");
            gitConfig.setAuthPassword(token.value);
        }

        const userGitConfig = workspace.config.gitConfig;
        if (!!userGitConfig) {
            Object.keys(userGitConfig)
                .filter(k => userGitConfig.hasOwnProperty(k))
                .forEach(k => gitConfig.getCustomConfigMap().set(k, userGitConfig[k]));
        }

        const result = new GitInitializer();
        result.setConfig(gitConfig);
        result.setCheckoutLocation(this.getCheckoutLocation(workspace));
        if (!!cloneTarget) {
            result.setCloneTaget(cloneTarget);
        }
        result.setRemoteUri(cloneUrl);
        result.setTargetMode(targetMode);
        if (!!upstreamRemoteURI) {
            result.setUpstreamRemoteUri(upstreamRemoteURI);
        }

        return {
            git: result,
            disposable
        };
    }

    protected getCheckoutLocation(workspace: Workspace) {
        return workspace.config.checkoutLocation || CommitContext.is(workspace.context) && workspace.context.repository.name || '.';
    }

    protected buildUpstreamCloneUrl(context: CommitContext): string | undefined {
        let upstreamCloneUrl: string | undefined = undefined;
        if (PullRequestContext.is(context) && context.base) {
            upstreamCloneUrl = context.base.repository.cloneUrl;
        } else if (context.repository.fork) {
            upstreamCloneUrl = context.repository.fork.parent.cloneUrl;
        }

        if (context.repository.cloneUrl === upstreamCloneUrl) {
            return undefined;
        }
        return upstreamCloneUrl;
    }

    protected toWorkspaceFeatureFlags(featureFlags: NamedWorkspaceFeatureFlag[]): WorkspaceFeatureFlag[] {
        const result = featureFlags.map(name => {
            for (const key in WorkspaceFeatureFlag) {
                if (key === name.toUpperCase()) {
                    return (WorkspaceFeatureFlag[key] as any) as WorkspaceFeatureFlag;
                }
            }
            log.warn(`not a valid workspace feature flag: ${name}`);
            return undefined;
        }).filter(f => !!f) as WorkspaceFeatureFlag[];

        return result;
    }

}
