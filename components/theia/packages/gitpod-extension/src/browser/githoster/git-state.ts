/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject, postConstruct } from "inversify";
import { Emitter, Event, ILogger } from "@theia/core";
import { Git, Repository } from "@theia/git/lib/common";
import { GitRepositoryTracker } from "@theia/git/lib/browser/git-repository-tracker";
import { IssueContext, CommitContext } from "@gitpod/gitpod-protocol";
import { GitpodInfoService } from "../../common/gitpod-info";
import { GitpodServiceProvider } from "../gitpod-service-provider";
import { GitHosterModel } from "./model/githoster-model";
import { contextUrlToUrl } from '@gitpod/gitpod-protocol/lib/util/context-url';

@injectable()
export abstract class GitState {

    @inject(Git)
    protected readonly git: Git;

    @inject(GitRepositoryTracker)
    protected readonly gitRepository: GitRepositoryTracker;

    @inject(GitpodInfoService)
    protected readonly infoService: GitpodInfoService;

    @inject(GitpodServiceProvider)
    protected readonly serviceProvider: GitpodServiceProvider;

    protected abstract readonly gitHosterModel: GitHosterModel;

    @inject(ILogger)
    protected readonly logger: ILogger;

    protected readonly onChangedEmitter = new Emitter<GitState.ChangeEvent>();
    readonly onChanged: Event<GitState.ChangeEvent> = this.onChangedEmitter.event;

    @postConstruct()
    protected init(): void {
        this.update();
        this.gitRepository.onGitEvent(() => this.update());
    }

    protected _repository?: Repository;

    protected _remoteBranch: GitState.RemoteBranch | undefined;
    get remoteBranch(): GitState.RemoteBranch | undefined {
        return this._remoteBranch;
    }

    protected _localBranch: GitState.LocalBranch | undefined;
    get localBranch(): GitState.LocalBranch | undefined {
        return this._localBranch;
    }

    protected key = '{}';
    protected shouldUpdate(): {
        repository?: Repository
        upstreamBranch?: string
        branch?: string
    } | undefined {
        const repository = this.gitRepository.selectedRepository;
        const status = this.gitRepository.selectedRepositoryStatus;
        const branch = status && status.branch;
        const upstreamBranch = status && status.upstreamBranch;
        const aheadBehind = status && status.aheadBehind;
        const key = JSON.stringify({ repository, branch, upstreamBranch, aheadBehind });
        if (this.key === key) {
            return undefined;
        }
        this.key = key;
        return { repository, upstreamBranch, branch };
    }
    protected async update(): Promise<void> {
        const change = this.shouldUpdate();
        if (!change) {
            return;
        }
        const remoteBranch = await this.computeRemoteBranch(change);
        // update internal state synchronously
        const localBranch = change.branch ? { name: change.branch } : undefined;
        this._remoteBranch = remoteBranch;
        this._localBranch = localBranch;
        this._repository = change.repository;
        this.onChangedEmitter.fire({ localBranch, remoteBranch, });
    }

    protected async computeRemoteBranch({ repository, upstreamBranch }: {
        repository?: Repository
        upstreamBranch?: string
    }): Promise<GitState.RemoteBranch | undefined> {
        if (!repository || !upstreamBranch) {
            return undefined;
        }
        const branchIndex = upstreamBranch.indexOf('/');
        const remote = upstreamBranch.slice(0, branchIndex);
        const headRefName = upstreamBranch.slice(branchIndex + 1);
        const remoteUrl = await this.getRemoteUrl(remote, repository);
        if (!remoteUrl) {
            return undefined;
        }
        const parsedRemoteUrl = this.parseRemoteUrl(remoteUrl);
        if (!parsedRemoteUrl) {
            return undefined;
        }
        const { owner, name } = parsedRemoteUrl;
        return {
            owner,
            repositoryName: name,
            headRefName,
            remoteUrl
        };
    }

    parseRemoteUrl(remoteUrl: string): { owner: string, name: string } | undefined {
        const host = new URL(remoteUrl).hostname;
        const startIndex = remoteUrl.indexOf(host);
        const endIndex = remoteUrl.lastIndexOf('.git');
        if (startIndex === -1 || endIndex === -1) {
            return undefined;
        }
        const ownerAndRepo = remoteUrl.slice(startIndex + host.length + 1, endIndex);
        const repositoryIndex = ownerAndRepo.lastIndexOf('/');
        const owner = ownerAndRepo.slice(0, repositoryIndex);
        const name = ownerAndRepo.slice(repositoryIndex + 1);
        return { owner, name };
    }
    
    async getRemoteUrl(remote: string = "origin", repository: Repository | undefined = this._repository): Promise<string | undefined> {
        if (!repository) {
            return undefined;
        }
        try {
            const remoteUrlResult = await this.git.exec(repository, ["remote", "get-url", remote]);
            return remoteUrlResult.stdout.trim();
        } catch (e) {
            return undefined;
        }
    }

    async useFork(fullName: string): Promise<void> {
        const localRepo = this.gitRepository.selectedRepository;
        if (!localRepo) {
            throw new Error("Local git repository not available.");
        }
        try {
            const remotes = await this.git.remote(localRepo);
            const hasOrigin = remotes.some(r => r == "origin");
            const hasUpstream = remotes.some(r => r == "upstream");
            if (!hasOrigin) {
                return;
            }
            const currentOriginUrl = await this.getRemoteUrl("origin");
            if (!currentOriginUrl) {
                return;
            }
            const parsedRemoteUrl = this.parseRemoteUrl(currentOriginUrl);
            if (!parsedRemoteUrl) {
                return;
            }
            const { owner, name } = parsedRemoteUrl;
            const newOriginUrl = currentOriginUrl.replace(`${owner}/${name}`, fullName);
            await this.git.exec(localRepo, ["remote", "set-url", "origin", newOriginUrl]);
            if (!hasUpstream) {
                await this.git.exec(localRepo, ["remote", "add", "upstream", currentOriginUrl]);
            }
        } catch (error) {
            const e = !!error ? error : new Error("Failed to set git remotes.");
            this.logger.error(e);
            throw e;
        }
    }

    async getCurrentContext(): Promise<{label: string, url: string} | undefined> {
        const { pullRequest } = this.gitHosterModel;
        if (pullRequest) {
            return {
                label: `${pullRequest.repository.owner.login}/${pullRequest.repository.name}#${pullRequest.number}`,
                url: `${pullRequest.url}`
            };
        }
        const remote = await this.getRemoteUrl();
        if (remote && (remote.startsWith('http') || remote.startsWith('https')) && remote.endsWith('.git')) {
            const trimmedUrl = remote.substr(0, remote.length - '.git'.length);
            const url = new URL(trimmedUrl);
            const segments = url.pathname.split('/');
            return {
                label: segments.slice(1).join('/'),
                url: trimmedUrl
            }
        }
        const info = await this.infoService.getInfo();
        const ws = await this.serviceProvider.getService().server.getWorkspace(info.workspaceId);
        if (IssueContext.is(ws.workspace.context)) {
            return {
                label: `${ws.workspace.context.repository.owner}/${ws.workspace.context.repository.name}#${ws.workspace.context.nr}`,
                url: `${ws.workspace.context.repository.cloneUrl.replace('.git', '/issues/')}${ws.workspace.context.nr}`
            }
        }
        if (CommitContext.is(ws.workspace.context)) {
            const url = contextUrlToUrl(ws.workspace.contextURL);
            if (url) {
              return {
                  label: `${url.pathname}`,
                  url: ws.workspace.context.repository.cloneUrl.replace('.git','')
              }
            }
        }
        return undefined;
    }
}

export namespace GitState {
    export const FACTORY_TYPE = Symbol("Factory<GitState>");
    
    export interface ChangeEvent {
        localBranch?: LocalBranch
        remoteBranch?: RemoteBranch
    }
    export interface RemoteBranch {
        owner: string
        repositoryName: string
        headRefName: string
        remoteUrl: string
    }
    export interface LocalBranch {
        name: string
    }
}
