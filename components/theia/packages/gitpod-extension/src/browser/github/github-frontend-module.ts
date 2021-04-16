/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import '../../../src/browser/github/style/index.css';

import { ContainerModule, Container } from "inversify";
import { bindViewContribution, FrontendApplicationContribution } from "@theia/core/lib/browser";
import { WidgetFactory } from "@theia/core/lib/browser";
import { GitDiffWidget } from "@theia/git/lib/browser/diff/git-diff-widget";
import { GitHubEndpoint } from './github-model/github-endpoint';
import { GitHubRestApi } from "./github-model/github-rest-api";
import { GitHubFrontendContribution, InitialGitHubDataProvider } from "./github-frontend-contribution";
import { GitHubModel } from "./github-model";
import { GitHubEditorManager } from "./github-editor";
import { GitHubEditorService, GitHubEditorServiceOptions, GitHubEditorServiceFactory } from "./github-editor/github-editor-service";
import { GitHubAnimationFrame } from "./github-animation-frame";
import { PullRequestWidget } from "./pull-request-widget";
import { PullRequestDiffWidget } from "./pull-request-diff-widget";
import { ReviewConversationManager, ReviewConversationMarker } from "./review-conversation";
import { createRequestConversationWidget, ReviewConversationContribution } from "./review-conversation-view";
import { GitHubGitState } from "./github-git-state";
import { GitHubGitErrorHandler } from "./git-error-handler/github-git-error-handler";
import { GitErrorHandler } from "@theia/git/lib/browser/git-error-handler";
import { GitHubForksLoader, GitHubForkCreator } from "./fork";
import { GitHubExtension, GITHUB_ID } from "./github-extension";
import { ForkCreator } from "../githoster/fork/fork-creator";
import { ForksLoader } from "../githoster/fork/forks-loader";
import { GitHosterExtension } from "../githoster/githoster-extension";
import { GITHOSTER } from "../githoster/githoster-frontend-module";
import { GitState } from "../githoster/git-state";
import { GitHosterModel } from "../githoster/model/githoster-model";

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(GitHubRestApi).toSelf().inSingletonScope();
    bind(GitHubAnimationFrame).toSelf().inRequestScope();
    bind(GitHubEndpoint).toSelf().inSingletonScope();
    bind<GitHosterModel>(GitHosterModel).to(GitHubModel).inSingletonScope().whenTargetTagged(GITHOSTER, GITHUB_ID);

    bind(GitHubEditorServiceFactory).toFactory(ctx =>
        (options: GitHubEditorServiceOptions) => {
            const container = new Container({ defaultScope: 'Singleton' });
            container.parent = ctx.container;
            container.bind(GitHubEditorService).toSelf();
            container.bind(GitHubEditorServiceOptions).toConstantValue(options);
            return container.get(GitHubEditorService);
        }
    );
    bind(GitHubEditorManager).toSelf().inSingletonScope();

    bind(PullRequestWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: PullRequestWidget.ID,
        createWidget: () => context.container.get(PullRequestWidget)
    }));

    bind<GitState>(GitState).to(GitHubGitState).inSingletonScope().whenTargetTagged(GITHOSTER, GITHUB_ID);
    bindViewContribution(bind, GitHubFrontendContribution);
    bind(FrontendApplicationContribution).toService(GitHubFrontendContribution);

    bind(InitialGitHubDataProvider).toSelf().inSingletonScope();
    rebind(GitDiffWidget).to(PullRequestDiffWidget);

    bind(ReviewConversationManager).toSelf().inSingletonScope();
    bind<WidgetFactory>(WidgetFactory).toDynamicValue(context => ({
        id: ReviewConversationMarker.kind,
        createWidget: () => createRequestConversationWidget(context.container)
    })).inSingletonScope();
    bindViewContribution(bind, ReviewConversationContribution);

    rebind(GitErrorHandler).to(GitHubGitErrorHandler);
    bind<ForksLoader>(ForksLoader).to(GitHubForksLoader).inSingletonScope().whenTargetTagged(GITHOSTER, GITHUB_ID);
    bind<ForkCreator>(ForkCreator.TYPE).to(GitHubForkCreator).inSingletonScope().whenTargetTagged(GITHOSTER, GITHUB_ID);

    bind(GitHubExtension).toSelf().inSingletonScope();
    bind<GitHosterExtension>(GitHosterExtension).toService(GitHubExtension);
});
