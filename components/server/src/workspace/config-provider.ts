/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import fetch from 'node-fetch';
import * as path from 'path';

import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import { User, WorkspaceConfig, CommitContext, Repository, ImageConfigString, ExternalImageConfigFile, ImageConfigFile, Commit, NamedWorkspaceFeatureFlag } from "@gitpod/gitpod-protocol";
import { GitpodFileParser } from "@gitpod/gitpod-protocol/lib/gitpod-file-parser";

import { MaybeContent } from "../repohost/file-provider";
import { ConfigInferenceProvider } from "./config-inference-provider";
import { HostContextProvider } from "../auth/host-context-provider";
import { AuthorizationService } from "../user/authorization-service";
import { TheiaPluginService } from "../theia-plugin/theia-plugin-service";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { Env } from "../env";

const POD_PATH_WORKSPACE_BASE = "/workspace";

@injectable()
export class ConfigProvider {
    static readonly DEFINITELY_GP_REPO: Repository = {
        host: 'github.com',
        owner: 'gitpod-io',
        name: 'definitely-gp',
        cloneUrl: 'https://github.com/gitpod-io/definitely-gp'
    };

    @inject(GitpodFileParser) protected readonly gitpodParser: GitpodFileParser
    @inject(ConfigInferenceProvider) protected readonly inferingConfigProvider: ConfigInferenceProvider;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(AuthorizationService) protected readonly authService: AuthorizationService;
    @inject(TheiaPluginService) protected readonly pluginService: TheiaPluginService;
    @inject(Env) protected readonly env: Env;

    public async fetchConfig(ctx: TraceContext, user: User, commit: CommitContext): Promise<WorkspaceConfig> {
        const span = TraceContext.startSpan("fetchConfig", ctx);
        span.addTags({
            commit
        })

        try {
            // try and find config file in the context repo or remote in
            const host = commit.repository.host;
            const hostContext = this.hostContextProvider.get(host);
            if (!hostContext || !hostContext.services) {
                throw new Error(`Cannot fetch config for host: ${host}`);
            }
            const services = hostContext.services;
            const contextRepoConfig = services.fileProvider.getGitpodFileContent(commit, user);
            const definitelyGpConfig = this.fetchExternalGitpodFileContent({ span }, commit.repository);
            const inferredConfig = this.inferingConfigProvider.infer(user, commit);

            let customConfigString = await contextRepoConfig;
            let configBasePath = '';
            let fromDefinitelyGp = false;
            if (!customConfigString) {
                /* We haven't found a Gitpod configuration file in the context repo - check definitely-gp.
                *
                * In case we had found a config file here, we'd still be checking the definitely GP repo, just to save some time.
                * While all those checks will be in vain, they should not leak memory either as they'll simply
                * be resolved and garbage collected.
                */
                const { content, basePath } = await definitelyGpConfig;
                customConfigString = content;
                // We do not only care about the config itself but also where we got it from
                configBasePath = basePath;
                fromDefinitelyGp = true;
            }

            let customConfig: WorkspaceConfig | undefined;
            const logContext: LogContext = { userId: user.id };
            if (customConfigString) {
                const parseResult = this.gitpodParser.parse(customConfigString);
                customConfig = parseResult.config
                await this.fillInDefaultLocations(customConfig, inferredConfig);
                if (parseResult.validationErrors) {
                    log.error(logContext, `Skipping invalid config. Errors are ${parseResult.validationErrors.join(',')}`, { repoCloneUrl: commit.repository.cloneUrl, revision: commit.revision, customConfigString });
                }
                customConfig._origin = fromDefinitelyGp ? 'definitely-gp' : 'repo';
            } else {
                /* There is no configuration for this repository. Before we fall back to the default config,
                * let's see if there is language specific configuration we might want to apply.
                */
                customConfig = await inferredConfig;
                if (customConfig) {
                    customConfig._origin = 'derived';
                }
            }

            if (!customConfig) {
                log.debug(logContext, 'Config string undefined, using default config', { repoCloneUrl: commit.repository.cloneUrl, revision: commit.revision });
                const config = this.defaultConfig();
                if (!ImageConfigString.is(config.image)) {
                    throw new Error(`Default config must contain a base image!`);
                }
                config._origin = 'default';
                return config;
            }

            const config = customConfig;
            if (!config.image) {
                config.image = this.env.workspaceDefaultImage;
            } else if (ImageConfigFile.is(config.image)) {
                let dockerfilePath = [configBasePath, config.image.file].filter(s => !!s).join('/');
                let repo = commit.repository;
                let rev = commit.revision;
                let image = config.image!;

                if (fromDefinitelyGp) {
                    repo = ConfigProvider.DEFINITELY_GP_REPO;
                    rev = 'master';
                    image.file = dockerfilePath;
                }

                config.image = <ExternalImageConfigFile>{
                    ...image,
                    externalSource: await this.fetchWorkspaceImageSourceDocker({ span }, repo, rev, user, dockerfilePath)
                }
            }

            config.vscode = {
                extensions: config && config.vscode && config.vscode.extensions || []
            };
            await this.validateConfig(config, user);

            /**
             * Some feature flags get attached to any workspace they create - others remain specific to the user.
             * Here we attach the workspace-persisted feature flags to the workspace.
             */
            delete (config._featureFlags);
            if (!!user.featureFlags) {
                const workspacePersistedFlags: NamedWorkspaceFeatureFlag[] = ["full_workspace_backup"];
                config._featureFlags = workspacePersistedFlags.filter(f => (user.featureFlags!.permanentWSFeatureFlags || []).includes(f));
            }

            return config;
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public defaultConfig(): WorkspaceConfig {
        return {
            ports: [{
                port: 3000
            }],
            tasks: [],
            image: this.env.workspaceDefaultImage
        };
    }

    protected async fetchWorkspaceImageSourceDocker(ctx: TraceContext, repository: Repository, revisionOrTagOrBranch: string, user: User, dockerFilePath: string): Promise<Commit> {
        const span = TraceContext.startSpan("fetchWorkspaceImageSourceDocker", ctx);
        span.addTags({
            repository,
            revisionOrTagOrBranch,
            dockerFilePath
        })

        try {
            const host = repository.host;
            const hostContext = this.hostContextProvider.get(host);
            if (!hostContext || !hostContext.services) {
                throw new Error(`Cannot fetch workspace image source for host: ${host}`);
            }
            const repoHost = hostContext.services;
            const lastDockerFileSha = await repoHost.fileProvider.getLastChangeRevision(repository, revisionOrTagOrBranch, user, dockerFilePath);
            return {
                repository,
                revision: lastDockerFileSha
            };
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async fillInDefaultLocations(cfg: WorkspaceConfig | undefined, inferredConfig: Promise<WorkspaceConfig | undefined>): Promise<void> {
        if (!cfg) {
            // there is no config - return
            return;
        }

        if (!cfg.checkoutLocation) {
            let inferredCfg = await inferredConfig;
            if (inferredCfg) {
                cfg.checkoutLocation = inferredCfg.checkoutLocation;
            }
        }
        if (!cfg.workspaceLocation) {
            let inferredCfg = await inferredConfig;
            if (inferredCfg) {
                cfg.workspaceLocation = inferredCfg.workspaceLocation;
            }
        }
    }

    protected async fetchExternalGitpodFileContent(ctx: TraceContext, repository: Repository): Promise<{ content: MaybeContent, basePath: string }> {
        const span = TraceContext.startSpan("fetchExternalGitpodFileContent", ctx);
        span.setTag("repo", `${repository.owner}/${repository.name}`);

        try {
            const ownerConfigBasePath = `${repository.name}/${repository.owner}`;
            const baseConfigBasePath = `${repository.name}`;

            const possibleConfigs = [
                [this.fetchDefinitelyGpContent({ span }, `${ownerConfigBasePath}/.gitpod.yml`), ownerConfigBasePath],
                [this.fetchDefinitelyGpContent({ span }, `${ownerConfigBasePath}/.gitpod`), ownerConfigBasePath],
                [this.fetchDefinitelyGpContent({ span }, `${baseConfigBasePath}/.gitpod.yml`), baseConfigBasePath],
                [this.fetchDefinitelyGpContent({ span }, `${baseConfigBasePath}/.gitpod`), baseConfigBasePath]
            ]
            for (const [configPromise, basePath] of possibleConfigs) {
                const ownerConfig = await configPromise;
                if (ownerConfig !== undefined) {
                    return {
                        content: ownerConfig,
                        basePath: basePath as string
                    };
                }
            }
            return {
                content: undefined,
                basePath: baseConfigBasePath
            }
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async fetchDefinitelyGpContent(ctx: TraceContext, filePath: string) {
        const span = TraceContext.startSpan("fetchDefinitelyGpContent", ctx);
        span.setTag("filePath", filePath);

        try {
            const url = `https://raw.githubusercontent.com/TypeFox/definitely-gp/master/${filePath}`;
            const response = await fetch(url, { method: 'GET' });
            let content;
            if (response.ok) {
                try {
                    content = await response.text();
                } catch { }
            }
            return content;
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async validateConfig(config: WorkspaceConfig, user: User): Promise<void> {
        // Make sure the projectRoot does not leave POD_PATH_WORKSPACE_BASE as that's a common
        // assumption throughout the code (e.g. ws-daemon)
        const checkoutLocation = config.checkoutLocation;
        if (checkoutLocation) {
            const normalizedPath = path.join(POD_PATH_WORKSPACE_BASE, checkoutLocation);
            if (this.leavesWorkspaceBase(normalizedPath)) {
                log.error({ userId: user.id }, `Invalid checkout location. Would end up at ${normalizedPath}`);
                throw new Error(`Checkout location must not leave the ${POD_PATH_WORKSPACE_BASE} folder. Check your .gitpod.yml file.`);
            }
        }

        const workspaceLocation = config.workspaceLocation;
        if (workspaceLocation) {
            const normalizedPath = path.join(POD_PATH_WORKSPACE_BASE, workspaceLocation);
            if (this.leavesWorkspaceBase(normalizedPath)) {
                log.error({ userId: user.id }, `Invalid workspace location. Would end up at ${normalizedPath}`);
                throw new Error(`Workspace location must not leave the ${POD_PATH_WORKSPACE_BASE} folder. Check your .gitpod.yml file.`);
            }
        }
    }

    protected leavesWorkspaceBase(normalizedPath: string) {
        const pathSegments = normalizedPath.split(path.sep);
        return normalizedPath.includes('..') || pathSegments.slice(0, 2).join('/') != POD_PATH_WORKSPACE_BASE;
    }

}
