/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { CommitContext, GitpodServer, UserEnvVar, UserEnvVarValue } from '@gitpod/gitpod-protocol';
import { ApplicationShell, OpenerService, Widget, WidgetOpenerOptions } from '@theia/core/lib/browser';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import URI from '@theia/core/lib/common/uri';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { MiniBrowserOpenHandler } from '@theia/mini-browser/lib/browser/mini-browser-open-handler';
import { inject, injectable } from 'inversify';
import { DeleteEnvvarRequest, DeleteEnvvarResponse, EnvironmentVariable, GetEnvvarsRequest, GetEnvvarsResponse, GetGitTokenRequest, GetGitTokenResponse, GetPortURLRequest, GetPortURLResponse, IsFileOpenRequest, IsFileOpenResponse, OpenFileRequest, OpenFileResponse, OpenPreviewRequest, OpenPreviewResponse, SetEnvvarRequest, SetEnvvarResponse, TheiaCLIService } from '../common/cli-service';
import { GitpodInfoService } from '../common/gitpod-info';
import { GitpodGitTokenProvider } from './gitpod-git-token-provider';
import { GitpodServiceProvider } from './gitpod-service-provider';
import { getWorkspaceID } from './utils';

export const CliServiceClient = Symbol('CliServiceClient');
export interface CliServiceClient extends TheiaCLIService {
    getGitToken(p: GetGitTokenRequest): Promise<GetGitTokenResponse>;
}

@injectable()
export class CliServiceClientImpl implements CliServiceClient {

    private readonly workspaceID = getWorkspaceID();

    @inject(GitpodInfoService) protected infoProvider: GitpodInfoService;
    @inject(OpenerService) protected readonly openerService: OpenerService;
    @inject(ApplicationShell) protected readonly shell: ApplicationShell;
    @inject(MiniBrowserOpenHandler) protected miniBrowserOpenHandler: MiniBrowserOpenHandler;
    @inject(FrontendApplicationStateService) protected applicationStateService: FrontendApplicationStateService;
    @inject(GitpodGitTokenProvider) protected gitTokenProvider: GitpodGitTokenProvider;
    @inject(EditorManager) protected readonly editorManager: EditorManager;

    private readonly isWorkspaceOwner: Promise<boolean>;

    constructor(
        @inject(GitpodServiceProvider)
        private readonly serviceProvider: GitpodServiceProvider
    ) {
        this.isWorkspaceOwner = serviceProvider.getService().server.isWorkspaceOwner(this.workspaceID)
    }

    protected async checkWorkspaceOwner() {
        if (!(await this.isWorkspaceOwner)) {
            throw new Error(`Only the workspace owner can handle this request.`);
        }
    }

    async getGitToken(p: GetGitTokenRequest): Promise<GetGitTokenResponse> {
        await this.checkWorkspaceOwner();
        return this.gitTokenProvider.getGitToken(p);
    }

    async openFile(params: OpenFileRequest): Promise<OpenFileResponse> {
        // make sure the application is fully initialized (e.g. README files have been opened)
        await this.applicationStateService.reachedState("ready");

        const path = params.path;
        const uri = new URI(`file://${path}`);
        const opener = await this.openerService.getOpener(uri);
        const widget = await opener.open(uri, <WidgetOpenerOptions>{ mode: 'reveal' });
        if (widget instanceof Widget) {
            this.shell.activateWidget(widget.id);
        }

        return {};
    }

    async openPreview(params: OpenPreviewRequest): Promise<OpenPreviewResponse> {
        await this.miniBrowserOpenHandler.openPreview(params.url);
        return {};
    }

    async getEnvVars(params: GetEnvvarsRequest): Promise<GetEnvvarsResponse> {
        const service = await this.serviceProvider.getService();
        const applicableVars = await this.getApplicableEnvvars(service.server);

        return {
            variables: applicableVars.map(v => <EnvironmentVariable>{
                name: v.name,
                value: v.value,
            })
        }
    }

    async setEnvVar(params: SetEnvvarRequest): Promise<SetEnvvarResponse> {
        const service = await this.serviceProvider.getService();

        const matchedVariables = await this.matchWithApplicableVars(params.variables, service.server);
        await Promise.all(matchedVariables.map(v => service.server.setEnvVar(v)));

        return {};
    }

    async deleteEnvVar(params: DeleteEnvvarRequest): Promise<DeleteEnvvarResponse> {
        const service = await this.serviceProvider.getService();

        const vars = params.variables.map(v => { return { name: v, value: "" } });
        const matchedVariables = await this.matchWithApplicableVars(vars, service.server);
        const candidates = matchedVariables.filter(v => !!v.id);
        await Promise.all(candidates.map(v => service.server.deleteEnvVar(v)));

        return {
            deleted: candidates.map(v => v.name),
            notDeleted: matchedVariables.filter(v => !v.id).map(v => v.name)
        };
    }

    async isFileOpen(params: IsFileOpenRequest): Promise<IsFileOpenResponse> {
        const isOpen = !!this.editorManager.all.find((w: EditorWidget) => w.editor.uri.path.toString() === `${params.path}`);
        return { isOpen };
    }

    protected async matchWithApplicableVars(variables: EnvironmentVariable[], service: GitpodServer): Promise<UserEnvVarValue[]> {
        const repinfo = await this.getRepo(service);
        if (!repinfo) {
            throw new Error("cannot get repo information");
        }

        const { owner, repo } = repinfo;
        const repositoryPattern = `${owner.toLocaleLowerCase()}/${repo.toLocaleLowerCase()}`;

        const applicableVars = await this.getApplicableEnvvars(service);
        return variables.map(v => {
            return {
                name: v.name,
                value: v.value,
                repositoryPattern
            }
        }).map(v => {
            const existingVar = applicableVars.find(av => av.name == v.name && av.repositoryPattern == v.repositoryPattern);
            const id = !!existingVar ? existingVar.id : undefined;
            return {
                ...v,
                id
            }
        });
    }

    protected async getApplicableEnvvars(service: GitpodServer): Promise<UserEnvVarValue[]> {
        const ws = await service.getWorkspace(this.workspaceID);

        const context = ws.workspace.context;
        if (!("repository" in context)) {
            return [];
        }
        const repository = (context as CommitContext).repository;

        const owner = repository.owner;
        const repo = repository.name;

        const vars = await service.getEnvVars();
        return UserEnvVar.filter(vars, owner, repo);

    }

    protected async getRepo(service: GitpodServer): Promise<{ owner: string, repo: string } | undefined> {
        const ws = await service.getWorkspace(this.workspaceID);

        const context = ws.workspace.context;
        if (!CommitContext.is(context)) {
            return;
        }

        const owner = context.repository.owner;
        const repo = context.repository.name;
        return { owner, repo };
    }

    async getPortURL(params: GetPortURLRequest): Promise<GetPortURLResponse> {
        const ws = await this.serviceProvider.getService().server.getWorkspace(this.workspaceID);
        if (!ws.latestInstance) {
            throw new Error("workspace has no instance");
        }

        const port = (ws.latestInstance.status.exposedPorts || []).find(p => p.port === params.port);
        if (!port) {
            throw new Error("port is not exposed");
        }
        if (!port.url) {
            throw new Error("port has no public URL");
        }

        return { url: port.url };
    }

}
