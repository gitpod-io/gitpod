/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { CommandContribution } from "@theia/core";
import { FrontendApplicationContribution } from "@theia/core/lib/browser";
import { ContainerModule, interfaces } from "inversify";
import { ForkCreator } from "./fork/fork-creator";
import { ForkMenu } from "./fork/fork-menu";
import { ForksLoader } from "./fork/forks-loader";
import { GitState } from "./git-state";
import { GitHosterScmCommitWidget } from "./git-widget/githoster-scm-commit-widget";
import { GitHosterExtension } from "./githoster-extension";
import { GitHosterFrontendContribution } from "./githoster-frontend-contribution";
import { GitHosterModel } from "./model/githoster-model";
import { ScmCommitWidget } from "@theia/scm/lib/browser/scm-commit-widget";


export default new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(ForkMenu).toSelf().inSingletonScope();

    bind(GitHosterFrontendContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(GitHosterFrontendContribution);
    bind(FrontendApplicationContribution).toService(GitHosterFrontendContribution);

    bind(GitHosterExtension.CURRENT_HOSTER).toFactory<GitHosterExtension | undefined>((context: interfaces.Context) => {
        return () => {
            const extensions = context.container.getAll(GitHosterExtension);
            return extensions.find(ext => ext.enabled);
        };
    })

    bind(GitHosterExtension.CURRENT_HOSTER_NAME).toFactory<string | undefined>((context: interfaces.Context) => {
        return () => {
            const extension = context.container.get<() => GitHosterExtension | undefined>(GitHosterExtension.CURRENT_HOSTER)();
            return extension ? extension.name : undefined;
        };
    })

    createHosterFactory<GitState>(bind, GitState.FACTORY_TYPE, GitState);
    createHosterFactory<GitHosterModel>(bind, GitHosterModel.FACTORY_TYPE, GitHosterModel);
    createHosterFactory<ForkCreator>(bind, ForkCreator.FACTORY_TYPE, ForkCreator.TYPE);
    createHosterFactory<ForksLoader>(bind, ForksLoader.FACTORY_TYPE, ForksLoader);

    rebind(ScmCommitWidget).to(GitHosterScmCommitWidget);
})

export const GITHOSTER = "GitHoster";

function createHosterFactory<T>(bind: interfaces.Bind, factoryServiceIntentifier: interfaces.ServiceIdentifier<T>, typeServiceIdentifier: interfaces.ServiceIdentifier<T>) {
    bind(factoryServiceIntentifier).toFactory<T>((context: interfaces.Context) => {
        return (hoster: string) => {
            const result = context.container.getTagged<T>(typeServiceIdentifier, GITHOSTER, hoster);
            if (!result) {
                console.error(`Could not find ${typeServiceIdentifier.toString()} for hoster '${hoster}'.`)
            }
            return result;
        };
    });
}
