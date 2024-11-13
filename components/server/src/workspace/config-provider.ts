/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import * as path from "path";
import * as crypto from "crypto";

import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import {
    User,
    WorkspaceConfig,
    CommitContext,
    Repository,
    ImageConfigString,
    ExternalImageConfigFile,
    ImageConfigFile,
    Commit,
    NamedWorkspaceFeatureFlag,
    AdditionalContentContext,
    WithDefaultConfig,
    ProjectConfig,
} from "@gitpod/gitpod-protocol";
import { GitpodFileParser } from "@gitpod/gitpod-protocol/lib/gitpod-file-parser";

import { ConfigurationService } from "../config/configuration-service";
import { HostContextProvider } from "../auth/host-context-provider";
import { AuthorizationService } from "../user/authorization-service";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { Config } from "../config";
import { EntitlementService } from "../billing/entitlement-service";
import { TeamDB } from "@gitpod/gitpod-db/lib";
import { InvalidGitpodYMLError } from "@gitpod/public-api-common/lib/public-api-errors";
import { ImageFileRevisionMissing, RevisionNotFoundError } from "../repohost";

const POD_PATH_WORKSPACE_BASE = "/workspace";

@injectable()
export class ConfigProvider {
    @inject(GitpodFileParser) protected readonly gitpodParser: GitpodFileParser;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(AuthorizationService) protected readonly authService: AuthorizationService;
    @inject(Config) protected readonly config: Config;
    @inject(ConfigurationService) protected readonly configurationService: ConfigurationService;
    @inject(EntitlementService) protected readonly entitlementService: EntitlementService;
    @inject(TeamDB) protected readonly teamDB: TeamDB;

    public async fetchConfig(
        ctx: TraceContext,
        user: User,
        commit: CommitContext,
        organizationId?: string,
    ): Promise<{ config: WorkspaceConfig; literalConfig?: ProjectConfig }> {
        const span = TraceContext.startSpan("fetchConfig", ctx);
        span.addTags({
            commit,
        });
        const logContext: LogContext = { userId: user.id };
        let configBasePath = "";
        try {
            let customConfig: WorkspaceConfig | undefined;
            let literalConfig: ProjectConfig | undefined;

            if (!WithDefaultConfig.is(commit)) {
                const cc = await this.fetchCustomConfig(ctx, user, commit);
                if (!!cc) {
                    customConfig = cc.customConfig;
                    configBasePath = cc.configBasePath;
                    literalConfig = cc.literalConfig;
                }
            }

            if (!customConfig) {
                log.debug(logContext, "Config string undefined, using default config", {
                    repoCloneUrl: commit.repository.cloneUrl,
                    revision: commit.revision,
                });
                const config = await this.defaultConfig(organizationId);
                if (!ImageConfigString.is(config.image)) {
                    throw new Error(`Default config must contain a base image!`);
                }
                config._origin = "default";
                return { config, literalConfig };
            }

            const config = customConfig;
            if (!config.image) {
                config.image = await this.getDefaultImage(organizationId);
            } else if (ImageConfigFile.is(config.image)) {
                const dockerfilePath = [configBasePath, config.image.file].filter((s) => !!s).join("/");
                const repo = commit.repository;
                const rev = commit.revision;
                const image = config.image!;

                if (!(AdditionalContentContext.is(commit) && commit.additionalFiles[dockerfilePath])) {
                    config.image = <ExternalImageConfigFile>{
                        ...image,
                        externalSource: await this.fetchWorkspaceImageSourceDocker(
                            { span },
                            repo,
                            rev,
                            user,
                            dockerfilePath,
                        ),
                    };
                }
            }

            config.vscode = {
                extensions: (config && config.vscode && config.vscode.extensions) || [],
            };
            await this.validateConfig(config, user);

            /**
             * Some feature flags get attached to any workspace they create - others remain specific to the user.
             * Here we attach the workspace-persisted feature flags to the workspace.
             */
            delete config._featureFlags;
            if (!!user.featureFlags) {
                config._featureFlags = (user.featureFlags!.permanentWSFeatureFlags || []).filter(
                    NamedWorkspaceFeatureFlag.isWorkspacePersisted,
                );
            }
            return { config, literalConfig };
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    // fetchCustomConfig entry is only used for unit tests data mocking
    public async fetchCustomConfig(
        ctx: TraceContext,
        user: User,
        commit: CommitContext,
    ): Promise<{ customConfig: WorkspaceConfig; configBasePath: string; literalConfig: ProjectConfig } | undefined> {
        const span = TraceContext.startSpan("fetchCustomConfig", ctx);
        const logContext: LogContext = { userId: user.id };
        let customConfigString: string | undefined;

        try {
            let customConfig: WorkspaceConfig | undefined;
            const configBasePath = "";
            if (AdditionalContentContext.is(commit) && commit.additionalFiles[".gitpod.yml"]) {
                customConfigString = commit.additionalFiles[".gitpod.yml"];
                const parseResult = this.gitpodParser.parse(customConfigString);
                customConfig = parseResult.config;
                customConfig._origin = "additional-content";
                if (parseResult.validationErrors) {
                    const err = new InvalidGitpodYMLError({
                        violations: parseResult.validationErrors,
                    });
                    // this is not a system error but a user misconfiguration
                    log.info(logContext, err.message, {
                        repoCloneUrl: commit.repository.cloneUrl,
                        revision: commit.revision,
                        customConfigString,
                    });
                    throw err;
                }
            }
            if (!customConfig) {
                // try and find config file in the context repo or remote in
                const host = commit.repository.host;
                const hostContext = this.hostContextProvider.get(host);
                if (!hostContext || !hostContext.services) {
                    throw new Error(`Cannot fetch config for host: ${host}`);
                }
                const services = hostContext.services;
                const contextRepoConfig = services.fileProvider.getGitpodFileContent(commit, user);
                customConfigString = await contextRepoConfig;
                let origin: WorkspaceConfig["_origin"] = "repo";

                if (!customConfigString) {
                    const inferredConfig = this.configurationService.guessRepositoryConfiguration(
                        { span },
                        user,
                        commit,
                    );
                    // if there's still no configuration, let's infer one
                    customConfigString = await inferredConfig;
                    origin = "derived";
                }

                if (customConfigString) {
                    const parseResult = this.gitpodParser.parse(customConfigString);
                    customConfig = parseResult.config;
                    if (parseResult.validationErrors) {
                        const err = new InvalidGitpodYMLError({
                            violations: parseResult.validationErrors,
                        });
                        // this is not a system error but a user misconfiguration
                        log.info(logContext, err.message, {
                            repoCloneUrl: commit.repository.cloneUrl,
                            revision: commit.revision,
                            customConfigString,
                        });
                        throw err;
                    }
                    customConfig._origin = origin;
                }
            }

            if (!customConfig) {
                return undefined;
            }

            return { customConfig, configBasePath, literalConfig: { ".gitpod.yml": customConfigString || "" } };
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public async defaultConfig(organizationId?: string): Promise<WorkspaceConfig> {
        return {
            ports: [],
            tasks: [],
            image: await this.getDefaultImage(organizationId),
            ideCredentials: crypto.randomBytes(32).toString("base64"),
        };
    }

    public async getDefaultImage(organizationId?: string) {
        let defaultImage = this.config.workspaceDefaults.workspaceImage;
        if (organizationId) {
            const settings = await this.teamDB.findOrgSettings(organizationId);
            if (settings?.defaultWorkspaceImage) {
                defaultImage = settings.defaultWorkspaceImage;
            }
        }
        return defaultImage;
    }

    private async fetchWorkspaceImageSourceDocker(
        ctx: TraceContext,
        repository: Repository,
        revisionOrTagOrBranch: string,
        user: User,
        dockerFilePath: string,
    ): Promise<Commit> {
        const span = TraceContext.startSpan("fetchWorkspaceImageSourceDocker", ctx);
        span.addTags({
            repository,
            revisionOrTagOrBranch,
            dockerFilePath,
        });

        try {
            const host = repository.host;
            const hostContext = this.hostContextProvider.get(host);
            if (!hostContext || !hostContext.services) {
                throw new Error(`Cannot fetch workspace image source for host: ${host}`);
            }
            const repoHost = hostContext.services;
            const lastDockerFileSha = await repoHost.fileProvider
                .getLastChangeRevision(repository, revisionOrTagOrBranch, user, path.normalize(dockerFilePath))
                .catch((e) => {
                    if (e instanceof RevisionNotFoundError) {
                        return ImageFileRevisionMissing;
                    }
                    throw e;
                });
            return {
                repository,
                revision: lastDockerFileSha,
            };
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    private async validateConfig(config: WorkspaceConfig, user: User): Promise<void> {
        // Make sure the projectRoot does not leave POD_PATH_WORKSPACE_BASE as that's a common
        // assumption throughout the code (e.g. ws-daemon)
        const checkoutLocation = config.checkoutLocation;
        if (checkoutLocation) {
            const normalizedPath = path.join(POD_PATH_WORKSPACE_BASE, checkoutLocation);
            if (this.leavesWorkspaceBase(normalizedPath)) {
                log.error({ userId: user.id }, `Invalid checkout location. Would end up at ${normalizedPath}`);
                throw new Error(
                    `Checkout location must not leave the ${POD_PATH_WORKSPACE_BASE} folder. Check your .gitpod.yml file.`,
                );
            }
        }

        const workspaceLocation = config.workspaceLocation;
        if (workspaceLocation) {
            const normalizedPath = path.join(POD_PATH_WORKSPACE_BASE, workspaceLocation);
            if (this.leavesWorkspaceBase(normalizedPath)) {
                log.error({ userId: user.id }, `Invalid workspace location. Would end up at ${normalizedPath}`);
                throw new Error(
                    `Workspace location must not leave the ${POD_PATH_WORKSPACE_BASE} folder. Check your .gitpod.yml file.`,
                );
            }
        }
    }

    private leavesWorkspaceBase(normalizedPath: string) {
        const pathSegments = normalizedPath.split(path.sep);
        return normalizedPath.includes("..") || pathSegments.slice(0, 2).join("/") != POD_PATH_WORKSPACE_BASE;
    }
}
