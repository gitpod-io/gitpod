/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import {
    Command, CommandRegistry, MaybePromise,
    SelectionService, UriSelection, Path, MenuModelRegistry, MessageService
} from "@theia/core";
import {
    AbstractViewContribution, StorageService, WidgetManager,
    FrontendApplication, FrontendApplicationContribution,
    OpenerService, open, supportCopy
} from "@theia/core/lib/browser";
import { GitHubEditorManager } from "./github-editor";
import { GitHubModel } from "./github-model";
import { PullRequestWidget } from "./pull-request-widget";
import URI from "@theia/core/lib/common/uri";
import { Range } from 'vscode-languageserver-types';
import { EditorContextMenu } from "@theia/editor/lib/browser";
import { NavigatorContextMenu } from "@theia/navigator/lib/browser/navigator-contribution";
import { GitHubExtension } from "./github-extension";
import { GitpodInfoService } from "../../common/gitpod-info";
import { GitpodServiceProvider } from "../gitpod-service-provider";
import { GitState } from "../githoster/git-state";
import { github } from "./github-decorators";
import { GitHosterModel } from "../githoster/model/githoster-model";
import { ScmService } from "@theia/scm/lib/browser/scm-service";

export namespace GitHubCommand {
    export const toggleId = 'github.toggle';
    export const refresh: Command = {
        id: 'github.refresh',
        label: 'GitHub: Refresh Pull Request'
    }
    export const merge: Command = {
        id: 'github.merge',
        label: 'GitHub: Merge Pull Request...'
    }
    export const toggleConversations: Command = {
        id: 'github.toggleConversations',
        label: 'GitHub: Toggle Conversation'
    }
    export const showAllConversations: Command = {
        id: 'github.showAllConversations',
        label: 'GitHub: Show All Conversations'
    }
    export const hideAllConversations: Command = {
        id: 'github.hideAllConversations',
        label: 'GitHub: Hide All Conversations'
    }
    export const startNewConversation: Command = {
        id: 'github.startNewConversation',
        label: 'GitHub: Start New Conversation'
    }
    export const openInGitHub: Command = {
        id: 'github.open',
        label: 'Open in GitHub'
    }
    export const copyGitHubLink: Command = {
        id: 'github.copy',
        label: 'Copy GitHub link'
    }
}

@injectable()
export class InitialGitHubDataProvider {
    getInitialGitHubData(): MaybePromise<GitHubFrontendContribution.Data> {
        return {};
    }
}

@injectable()
export class GitHubFrontendContribution extends AbstractViewContribution<PullRequestWidget> implements FrontendApplicationContribution {

    @inject(GitHosterModel) @github
    protected readonly gitHub: GitHubModel;

    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;

    @inject(GitHubEditorManager)
    protected readonly editorManager: GitHubEditorManager;

    @inject(GitState) @github
    protected readonly gitState: GitState;

    @inject(StorageService)
    protected readonly storageService: StorageService;

    @inject(InitialGitHubDataProvider)
    protected readonly initialDataProvider: InitialGitHubDataProvider;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    @inject(SelectionService)
    protected readonly selectionService: SelectionService;

    @inject(GitHubExtension)
    protected readonly extension: GitHubExtension;

    @inject(GitpodInfoService)
    protected readonly infoService: GitpodInfoService;

    @inject(GitpodServiceProvider)
    protected readonly serviceProvider: GitpodServiceProvider;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(ScmService)
    protected readonly scmService: ScmService;

    constructor() {
        super({
            widgetId: PullRequestWidget.ID,
            widgetName: PullRequestWidget.LABEL,
            defaultWidgetOptions: {
                area: 'right',
                rank: 1000
            },
            toggleCommandId: GitHubCommand.toggleId,
            toggleKeybinding: 'ctrl+shift+h'
        });
    }

    async onStart(): Promise<void> {
        await this.restore();

        this.gitHub.onDidChange(() => {
            this.updateData();
        });

        this.extension.onStateChanged(({ enabled }) => {
            this.refresh();
        })

        this.gitState.onChanged(() => {
            this.refresh();
        });
        this.refresh();
    }

    async initializeLayout(app: FrontendApplication): Promise<void> {
        // Don't block if the github extension is not yet initialized, which might
        // be the case when the selected repository isn't ready yet.
        (async () => {
            await this.extension.initialized;
            if (this.extension.enabled) {
                await this.openView();
                this.initializeViews(); // do not await this
            }
        })();
        return Promise.resolve();
    }

    /**
     * Let's initialize views on first opening here. We can use initial GitHub date, as well as
     * the state of the local git repository, to decide which widgets to show.
     */
    protected async initializeViews(): Promise<void> {
        const initialData = await this.initData();
        if (initialData.base) {
            if (initialData.issue) {
                await this.whenHasLocalBranch();
            } {
                await this.whenHasRemoteBranch();
            }
            await this.refresh();
        }
        if (initialData.issue) {
            this.initializeFromIssue();
        } else {
            await this.openPullRequestViews();
        }
    }

    protected whenHasLocalBranch(): Promise<void> {
        return new Promise(resolve => {
            if (this.gitState.localBranch) {
                resolve();
            } else {
                const disposable = this.gitState.onChanged(event => {
                    if (event.localBranch) {
                        resolve();
                        disposable.dispose();
                    }
                });
            }
        });
    }

    protected whenHasRemoteBranch(): Promise<void> {
        return new Promise(resolve => {
            if (this.gitState.remoteBranch) {
                resolve();
            } else {
                const disposable = this.gitState.onChanged(event => {
                    if (event.remoteBranch) {
                        resolve();
                        disposable.dispose();
                    }
                });
            }
        });
    }

    protected async refresh(): Promise<void> {
        if (!this.extension.enabled) {
            return;
        }
        const remoteBranch = this.gitState.remoteBranch;
        if (remoteBranch) {
            const { base } = this.data;
            await this.gitHub.refresh({
                kind: 'compare',
                head: {
                    owner: remoteBranch.owner,
                    repository: remoteBranch.repositoryName,
                    refName: remoteBranch.headRefName
                },
                base
            });
        } else {
            this.gitHub.clean();
        }
    }

    protected async openPullRequestViews(): Promise<void> {
        const pullRequest = this.gitHub.pullRequest;
        if (pullRequest) {
            const pullRequestWidget = await this.openView();
            await pullRequestWidget.showDiff({ trySelectFirst: true });
        }
    }

    protected initializeFromIssue(): void {
        const message = this.computeInitialCommitMessage();
        if (this.scmService.selectedRepository) {
            this.scmService.selectedRepository.input.value = message;
        }
    }

    protected computeInitialCommitMessage(): string {
        const issue = this.data.issue;
        if (issue) {
            const issueReference = `${issue.owner}/${issue.repository}#${issue.nr}`;
            const message = `\n\nFixes ${issueReference}`
            return message;
        }
        return '';
    }

    onStop(): void {
        this.store();
    }

    // TODO make it per host
    protected readonly dataKey = 'github';
    protected data: Readonly<GitHubFrontendContribution.Data> = {};
    protected async restore(): Promise<void> {
        this.data = {
            ...await this.storageService.getData(this.dataKey),
            ...this.createData()
        };
    }
    protected store(): Promise<void> {
        return this.storageService.setData(this.dataKey, this.data);
    }
    protected async initData(): Promise<GitHubFrontendContribution.Data> {
        this.data = await this.initialDataProvider.getInitialGitHubData();
        return this.data;
    }
    protected updateData(): void {
        this.data = this.createData();
    }
    protected createData(): Readonly<GitHubFrontendContribution.Data> {
        const { base } = this.gitHub;
        const data: GitHubFrontendContribution.Data = {};
        if (base && base.raw) {
            data.base = base.raw;
        }
        return data;
    }

    registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand(GitHubCommand.refresh, {
            isEnabled: () => this.extension.enabled,
            execute: () => this.gitHub.refresh()
        });
        this.widget.then(pullRequestWidget => {
            commands.registerCommand(GitHubCommand.merge, {
                isEnabled: () => this.extension.enabled && pullRequestWidget.canMerge(),
                isVisible: () => this.extension.enabled && pullRequestWidget.canMerge(),
                execute: () => pullRequestWidget.merge()
            });
        })
        commands.registerCommand(GitHubCommand.toggleConversations, {
            execute: () => {
                const widget = this.editorManager.editorWidget;
                if (widget) {
                    widget.toggle();
                }
            },
            isEnabled: () => this.extension.enabled && !!this.editorManager.editorWidget && this.editorManager.editorWidget.model.enabled
        });
        commands.registerCommand(GitHubCommand.showAllConversations, {
            execute: () => this.editorManager.editorWidgets.forEach(w => w.show()),
            isEnabled: () => this.extension.enabled && this.editorManager.editorWidgets.some(w => w.model.enabled)
        });
        commands.registerCommand(GitHubCommand.hideAllConversations, {
            execute: () => this.editorManager.editorWidgets.forEach(w => w.hide()),
            isEnabled: () => this.extension.enabled && this.editorManager.editorWidgets.some(w => w.model.enabled)
        });
        commands.registerCommand(GitHubCommand.startNewConversation, {
            execute: () => {
                const widget = this.editorManager.editorWidget;
                if (widget) {
                    widget.startNewConversation();
                }
            },
            isEnabled: () => this.extension.enabled && !!this.editorManager.editorWidget
        });
        commands.registerCommand(GitHubCommand.openInGitHub, {
            execute: () => this.openInGitHub(),
            isEnabled: () => this.extension.enabled && !!this.gitHubLink,
            isVisible: () => this.extension.enabled && !!this.gitHubLink
        });
        if (supportCopy) {
            commands.registerCommand(GitHubCommand.copyGitHubLink, {
                execute: () => this.copyGitHubLink(),
                isEnabled: () => this.extension.enabled && !!this.gitHubLink,
                isVisible: () => this.extension.enabled && !!this.gitHubLink
            });
        }
    }

    registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);
        menus.registerMenuAction(NavigatorContextMenu.OPEN, {
            commandId: GitHubCommand.openInGitHub.id
        });
        if (supportCopy) {
            menus.registerMenuAction(NavigatorContextMenu.CLIPBOARD, {
                commandId: GitHubCommand.copyGitHubLink.id
            });
        }
        menus.registerMenuAction(EditorContextMenu.NAVIGATION, {
            commandId: GitHubCommand.openInGitHub.id
        });
        if (supportCopy) {
            menus.registerMenuAction(EditorContextMenu.CUT_COPY_PASTE, {
                commandId: GitHubCommand.copyGitHubLink.id
            });
        }
    }

    openInGitHub(): void {
        const link = this.gitHubLink;
        if (link) {
            open(this.openerService, link);
        }
    }

    copyGitHubLink(): void {
        const link = this.gitHubLink;
        if (link) {
            this.copyToClipboard(link.toString());
        }
    }

    protected get gitHubLink(): URI | undefined {
        const { remoteBranch } = this.gitState;
        if (!remoteBranch) {
            return undefined;
        }
        const { owner, repositoryName, remoteUrl, headRefName } = remoteBranch;
        let path = new Path(owner + '/' + repositoryName);

        let blob = headRefName;
        const status = this.gitHub['gitRepository'].selectedRepositoryStatus;
        if (status) {
            const { aheadBehind, currentHead } = status;
            if (currentHead && aheadBehind && !aheadBehind.ahead) {
                blob = currentHead;
            }
        }

        const { selection } = this.selectionService;
        const fileUri = UriSelection.getUri(selection);
        const gitHubPath = fileUri && this.gitHub.getPath(fileUri);
        if (gitHubPath) {
            path = path.join('blob', blob, gitHubPath);
        } else {
            path = path.join('tree', blob);
        }

        const link = new URI(remoteUrl).withScheme('https').withPath(path);
        const textEditor = Array.isArray(selection) ? selection[0] : selection;
        const range: Range | undefined = textEditor && 'selection' in textEditor && Range.is(textEditor['selection']) ? textEditor['selection'] : undefined;
        if (range) {
            let fragment = 'L' + (range.start.line + 1);
            if (range.start.line !== range.end.line) {
                fragment += '-L' + (range.end.line + 1);
            }
            return link.withFragment(fragment);
        }
        return link;
    }


    protected copyToClipboard(value: string): void {
        const element = document.createElement('textarea');
        element.value = value;
        element.setAttribute('readonly', '');
        element.style.position = 'absolute';
        element.style.left = '-9999px';
        document.body.appendChild(element);
        const selection = document.getSelection();
        const selected = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : false;
        element.select();
        document.execCommand('copy');
        document.body.removeChild(element);
        if (selected && selection) {
            selection.removeAllRanges();
            selection.addRange(selected);
        }
    };

}
export namespace GitHubFrontendContribution {
    export interface Data {
        issue?: GitHubModel.GitHubIssue
        base?: GitHubModel.RawRef
    }
}
