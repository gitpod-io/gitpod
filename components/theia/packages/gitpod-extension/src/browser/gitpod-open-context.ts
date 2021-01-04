/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import { ILogger } from '@theia/core/lib/common/logger';
import { GitpodInfoService } from "../common/gitpod-info";
import { FrontendApplicationContribution, FrontendApplication, SelectableTreeNode, StorageService, OpenerService, WidgetOpenerOptions, ApplicationShell, Widget, open } from "@theia/core/lib/browser";
import { FileNavigatorContribution } from "@theia/navigator/lib/browser/navigator-contribution";
import { FileNavigatorModel } from '@theia/navigator/lib/browser/navigator-model';
import { WorkspaceNode } from '@theia/navigator/lib/browser/navigator-tree';
import { NavigatorContext, WorkspaceContext, Workspace, PullRequestContext, IssueContext } from "@gitpod/gitpod-protocol/lib/protocol";
import { FileNode } from '@theia/filesystem/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { GitpodServiceProvider } from './gitpod-service-provider';
import { GitHubFrontendContribution, InitialGitHubDataProvider } from './github';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { PreviewUri } from '@theia/preview/lib/browser/preview-uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileStat } from '@theia/filesystem/lib/common/files';

@injectable()
export class GitpodOpenContext implements FrontendApplicationContribution, InitialGitHubDataProvider {

    @inject(ILogger) protected readonly logger: ILogger;
    @inject(OpenerService) protected readonly openerService: OpenerService;
    @inject(GitpodServiceProvider) protected readonly gitpodServiceProvider: GitpodServiceProvider;
    @inject(GitpodInfoService) protected readonly GitpodInfoService: GitpodInfoService;
    @inject(StorageService) protected readonly storageService: StorageService;
    @inject(FileNavigatorContribution) protected readonly navigator: FileNavigatorContribution;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(FileService) protected readonly fileService: FileService;
    @inject(ApplicationShell) protected readonly shell: ApplicationShell;

    private workspace: Workspace;

    async onStart(app: FrontendApplication) {
        const info = await this.GitpodInfoService.getInfo();
        const service = await this.gitpodServiceProvider.getService();
        this.workspace = (await service.server.getWorkspace(info.workspaceId)).workspace;
        await this.refresh();
    }

    protected readonly initialGitHubData = new Deferred<GitHubFrontendContribution.Data>();
    getInitialGitHubData(): Promise<GitHubFrontendContribution.Data> {
        return this.initialGitHubData.promise;
    }
    protected resolveInitialGitHubData(context: WorkspaceContext): void {
        if (PullRequestContext.is(context)) {
            const { base } = context;
            this.initialGitHubData.resolve({
                base: {
                    owner: base.repository.owner,
                    repository: base.repository.name,
                    refName: base.ref
                }
            });
        } else if (IssueContext.is(context)) {
            const { nr, repository } = context;
            this.initialGitHubData.resolve({
                issue: {
                    nr,
                    owner: repository.owner,
                    repository: repository.name
                }
            });
        } else {
            this.initialGitHubData.resolve({});
        }
    }

    async initializeLayout(app: FrontendApplication) {
        try {
            await this.handleContext(this.workspace.context);
        } catch (err) {
            if (err && err.message) {
                this.logger.error(err.message);
            }
        }
    }

    protected async handleContext(context: WorkspaceContext) {
        this.resolveInitialGitHubData(context);
        if (NavigatorContext.is(context)) {
            const path = context.path;
            const isFile = context.isFile;
            await this.expandPathInNavigator(path, isFile);
            await this.openReadmeInDirectory(path);
        }
        if (IssueContext.is(context)) {
            const path = '';
            const isFile = false;
            await this.expandPathInNavigator(path, isFile);
            await this.openReadmeInDirectory(path);
        }
        await this.refresh();
    }

    protected async refresh(): Promise<void> {
        // Set page title
        document.title = this.workspace.description;
    }

    protected async openReadmeInDirectory(path: string): Promise<void> {
        const readmeUri = await this.findReadmeInContext(path);
        if (readmeUri) {
            const previewUri = PreviewUri.encode(readmeUri);
            const widget = await open(this.openerService, previewUri, <WidgetOpenerOptions>{ mode: 'reveal' });
            if (widget instanceof Widget) {
                this.shell.activateWidget(widget.id);
            }
        }
    }

    protected async findReadmeInContext(path: string): Promise<URI | undefined> {
        let location: FileStat | undefined = (await this.workspaceService.roots)[0];
        if (!location) {
            return undefined;
        }
        if (path) {
            const contextUri = location.resource.resolve(path)
            try {
                location = await this.fileService.resolve(contextUri, { resolveMetadata: true });
            } catch {
                location = undefined;
            }
        }
        if (location && location.children) {
            let readme: FileStat | undefined;
            for (const f of location.children) {
                // we want to use the readme with the shortest name, as there are repos with multiple readme in different languages.
                if (!f.isDirectory) {
                    const fileName = f.resource.path.base.toLowerCase();
                    if (fileName.startsWith('readme') &&
                        (!readme || readme.resource.toString().length > f.resource.toString().length)) {
                        readme = f;
                    }
                }
            }
            if (readme) {
                return readme.resource;
            }
        }
        return undefined;
    }


    protected async expandPathInNavigator(path: string, isFile: boolean): Promise<void> {
        const widget = await this.navigator.openView();
        this.shell.activateWidget(widget.id);
        const model = widget.model;
        if (widget.model.root === undefined) {
            const disposable = model.onNodeRefreshed(async event => {
                if (WorkspaceNode.is(model.root)) {
                    disposable.dispose();
                    await this.expandPath(model, isFile, path);
                }
            });
        } else {
            await this.expandPath(model, isFile, path);
        }
    }

    protected async expandPath(model: FileNavigatorModel, isFile: boolean, path: string) {
        const root = model.root;
        if (!WorkspaceNode.is(root)) {
            return;
        }
        // TODO We should resolve a path against checkout location, not against first root.
        // There is no guarantee that there is a root pointing to a checkout location in the multi-root workspace at all.
        const uri = root.children[0].uri.resolve(path);
        const node = await model.revealFile(uri);
        if (!node) {
            return;
        }
        if (FileNode.is(node) && isFile) {
            try {
                await open(this.openerService, node.uri);
            } catch (err) {
                this.logger.error("Unable to open file: " + err ? err.message : err);
            }
        }
        if (SelectableTreeNode.is(node)) {
            model.selectNode(node);
        }
    }

}

// Suppress workspace base folder name as title
@injectable()
export class GitpodWorkspaceService extends WorkspaceService {

    protected updateTitle(): void {
        // document.title = uri.displayName;
    }

}
