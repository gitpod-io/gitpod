/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import '../../src/browser/extensions/style/extensions.css'

import { ContainerModule, injectable } from "inversify";
import { GitHubTokenProvider, InitialGitHubDataProvider, GetGitHubTokenParams } from "./github";
import { GitpodCreditAlerContribution } from './gitpod-credit-alert-contribution';
import { FrontendApplicationContribution, WebSocketConnectionProvider, WidgetFactory, bindViewContribution, ShellLayoutRestorer, CommonFrontendContribution, FrontendApplication } from '@theia/core/lib/browser';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import { GitpodLocalStorageService } from './gitpod-local-storage-service';
import { GitpodOpenContext, GitpodWorkspaceService } from './gitpod-open-context';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { TerminalWidget } from "@theia/terminal/lib/browser/base/terminal-widget";
import { GitpodTerminalWidget } from "./gitpod-terminal-widget";
import { GitpodInfoService, gitpodInfoPath } from "../common/gitpod-info";
import { GitpodServiceProvider } from "./gitpod-service-provider";
import { GitpodUiContribution } from "./gitpod-ui-contribution";
import { CommandContribution, MenuContribution, MenuModelRegistry } from "@theia/core";
import { GitpodAccountInfoDialog, GitpodAccountInfoDialogProps } from "./gitpod-account-info";
import { UserMessageContribution } from "./user-message/user-message-contribution";
import { GitpodShareWidget, GitpodShareDialog, GitpodShareDialogProps } from "./gitpod-share-widget";
import { GitpodAboutDialog, GitpodAboutDialogProps } from "./gitpod-about-dialog";
import { AboutDialog } from "@theia/core/lib/browser/about-dialog";
import { GitpodPortViewContribution } from "./ports/gitpod-port-view-contribution";
import { GitpodPortViewWidget, PORT_WIDGET_FACTORY_ID } from "./ports/gitpod-port-view-widget";
import { GitpodPortsService } from "./ports/gitpod-ports-service";
import { GitRepositoryProvider } from "@theia/git/lib/browser/git-repository-provider";
import { GitpodRepositoryProvider } from "./gitpod-repository-provider";
import { UserStorageContribution } from "@theia/userstorage/lib/browser/user-storage-contribution";
import { CliServiceClientImpl, CliServiceClient } from "./cli-service-client";
import { SERVICE_PATH } from "../common/cli-service";
import { CliServiceContribution } from "./cli-service-contribution";
import { SnapshotSupport } from "./gitpod-snapshot-support";
import { GitpodLayoutRestorer } from "./gitpod-shell-layout-restorer";
import { GitpodFileParser } from "@gitpod/gitpod-protocol/lib/gitpod-file-parser";
import { MarkdownPreviewHandler } from '@theia/preview/lib/browser/markdown'
import { GitpodMarkdownPreviewHandler } from "./user-message/GitpodMarkdownPreviewHandler";
import { GitpodPreviewLinkNormalizer } from "./user-message/GitpodPreviewLinkNormalizer";
import { PreviewLinkNormalizer } from "@theia/preview/lib/browser/preview-link-normalizer";
import { GitpodMenuModelRegistry } from "./gitpod-menu";
import { GitpodWebSocketConnectionProvider } from './gitpod-ws-connection-provider';
import { GitHostWatcher } from './git-host-watcher';
import { GitpodExternalUriService } from './gitpod-external-uri-service';
import { ExternalUriService } from '@theia/core/lib/browser/external-uri-service';
import { GitpodGitTokenProvider } from './gitpod-git-token-provider';
import { setupModule } from './setup/setup-module';
import { GitpodBranding } from './gitpod-branding';
import { GitpodMainMenuFactory } from './gitpod-main-menu';
import { BrowserMainMenuFactory } from '@theia/core/lib/browser/menu/browser-menu-plugin';
import { GitpodCommonFrontendContribution } from './gitpod-common-frontend-contribution';
import { GitpodGitTokenValidator } from './gitpod-git-token-validator';
import { ConnectionStatusOptions } from '@theia/core/lib/browser/connection-status-service';
import { extensionsModule } from './extensions/extensions-module';
import { GitpodUserStorageContribution } from './gitpod-user-storage-contribution';
import { GitpodUserStorageProvider } from './gitpod-user-storage-provider';
import { Emitter } from '@theia/core/lib/common/event';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { GitpodTaskContribution } from './gitpod-task-contribution';
import { GitpodTaskServer, gitpodTaskServicePath } from '../common/gitpod-task-protocol';
import { GitpodPortServer, gitpodPortServicePath } from '../common/gitpod-port-server';

@injectable()
class GitpodFrontendApplication extends FrontendApplication {

    async start(): Promise<void> {
        const pendingStart = new Deferred<void>();
        const stateService = this.stateService;
        const onDidChangeEmitter = new Emitter<void>();
        const toStop = new DisposableCollection(
            onDidChangeEmitter,
            Disposable.create(() => {
                // save state on workspace stop
                this.layoutRestorer.storeLayout(this);
                this.stopContributions();
            })
        );
        window.gitpod.ideService = {
            get state() {
                if (toStop.disposed) {
                    return 'terminated';
                }
                // closing_window because of https://github.com/eclipse-theia/theia/issues/8618
                if (stateService.state === 'ready' || stateService.state === 'closing_window') {
                    return 'ready';
                }
                return 'init';
            },
            onDidChange: onDidChangeEmitter.event,
            start: () => {
                super.start().then(pendingStart.resolve, pendingStart.reject);
                return toStop;
            }
        };
        stateService.onStateChanged(() => onDidChangeEmitter.fire());
        return pendingStart.promise;
    }

}

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    rebind(FrontendApplication).to(GitpodFrontendApplication).inSingletonScope();

    rebind(CommonFrontendContribution).to(GitpodCommonFrontendContribution).inSingletonScope();

    bind(GitpodGitTokenValidator).toSelf().inSingletonScope();
    bind(GitpodGitTokenProvider).toSelf().inSingletonScope();
    bind(GitHubTokenProvider).toDynamicValue(ctx => {
        const tokenProvider = ctx.container.get(GitpodGitTokenProvider);
        return {
            getToken: (params: GetGitHubTokenParams) => tokenProvider.getGitToken(params).then(result => result.token)
        }
    }).inSingletonScope();

    bind(GitpodCreditAlerContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(GitpodCreditAlerContribution);

    bind(GitpodOpenContext).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(GitpodOpenContext);
    rebind(InitialGitHubDataProvider).toService(GitpodOpenContext);

    bind(GitpodTaskServer).toDynamicValue(context => WebSocketConnectionProvider.createProxy(context.container, gitpodTaskServicePath)).inSingletonScope();
    bind(FrontendApplicationContribution).to(GitpodTaskContribution).inSingletonScope();

    bind(GitpodShareWidget).toSelf().inSingletonScope();
    bind(GitpodShareDialog).toSelf().inSingletonScope();
    bind(GitpodShareDialogProps).toConstantValue({ title: 'Share Workspace' });
    bind(GitpodUiContribution).toSelf().inSingletonScope();

    bind(CommandContribution).toService(GitpodUiContribution);
    bind(MenuContribution).toService(GitpodUiContribution);
    bind(FrontendApplicationContribution).toService(GitpodUiContribution);

    bind(GitpodAccountInfoDialog).toSelf().inSingletonScope();
    bind(GitpodAccountInfoDialogProps).toConstantValue({ title: 'Account' });

    bind(GitpodServiceProvider).toSelf().inSingletonScope();

    rebind(StorageService).to(GitpodLocalStorageService).inSingletonScope();
    rebind(WorkspaceService).to(GitpodWorkspaceService).inSingletonScope();

    rebind(TerminalWidget).to(GitpodTerminalWidget).inTransientScope();

    bind(GitpodPortServer).toDynamicValue(context => WebSocketConnectionProvider.createProxy(context.container, gitpodPortServicePath)).inSingletonScope();
    bind(GitpodPortsService).toSelf().inSingletonScope();

    bind(CliServiceClientImpl).toSelf().inSingletonScope();
    bind(CliServiceClient).toDynamicValue(context => {
        const client = context.container.get(CliServiceClientImpl);
        WebSocketConnectionProvider.createProxy(context.container, SERVICE_PATH, client);
        return client;
    }).inSingletonScope();

    bind(CliServiceContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(CliServiceContribution);

    bind(UserMessageContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(UserMessageContribution);
    bind(CommandContribution).toService(UserMessageContribution);
    bind(MenuContribution).toService(UserMessageContribution);

    bind(GitpodAboutDialogProps).toSelf().inSingletonScope();
    rebind(AboutDialog).to(GitpodAboutDialog).inSingletonScope();

    bind(GitpodPortViewWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: PORT_WIDGET_FACTORY_ID,
        createWidget: () => context.container.get<GitpodPortViewWidget>(GitpodPortViewWidget)
    }));

    bindViewContribution(bind, GitpodPortViewContribution);
    bind(FrontendApplicationContribution).toService(GitpodPortViewContribution);

    rebind(GitRepositoryProvider).to(GitpodRepositoryProvider).inSingletonScope();

    bind(GitpodUserStorageProvider).toSelf().inSingletonScope();
    rebind(UserStorageContribution).to(GitpodUserStorageContribution).inSingletonScope();

    bind(SnapshotSupport).toSelf().inSingletonScope();
    bind(CommandContribution).toService(SnapshotSupport);

    bind(GitpodLayoutRestorer).toSelf().inSingletonScope();
    rebind(ShellLayoutRestorer).toService(GitpodLayoutRestorer);

    bind(GitpodFileParser).toSelf().inSingletonScope();

    bind(GitpodMarkdownPreviewHandler).toSelf().inSingletonScope();
    rebind(MarkdownPreviewHandler).toService(GitpodMarkdownPreviewHandler);

    bind(GitpodPreviewLinkNormalizer).toSelf().inSingletonScope();
    rebind(PreviewLinkNormalizer).toService(GitpodPreviewLinkNormalizer);

    rebind(MenuModelRegistry).to(GitpodMenuModelRegistry).inSingletonScope();

    bind(GitpodWebSocketConnectionProvider).toSelf().inSingletonScope();
    rebind(WebSocketConnectionProvider).toService(GitpodWebSocketConnectionProvider);

    extensionsModule(bind, unbind, isBound, rebind);

    bind(GitpodInfoService).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<GitpodInfoService>(gitpodInfoPath);
    });

    bind(FrontendApplicationContribution).to(GitHostWatcher).inSingletonScope();

    bind(GitpodExternalUriService).toSelf().inSingletonScope();
    rebind(ExternalUriService).toService(GitpodExternalUriService);

    setupModule(bind, unbind, isBound, rebind);

    bind(GitpodBranding).toSelf().inSingletonScope();
    bind(GitpodMainMenuFactory).toSelf().inSingletonScope();
    rebind(BrowserMainMenuFactory).toService(GitpodMainMenuFactory);

    bind(ConnectionStatusOptions).toConstantValue({
        offlineTimeout: 20000
    });
});