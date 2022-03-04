/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";
import { AuthProvider } from "../auth/auth-provider";
import { FileProvider, LanguagesProvider, RepositoryProvider, RepositoryHost } from "../repohost";
import { IContextParser } from "../workspace/context-parser";
import { IGitTokenValidator } from "../workspace/git-token-validator";
import { GitLabApi } from "./api";
import { GitlabFileProvider } from "./file-provider";
import { GitLabAuthProvider } from "./gitlab-auth-provider";
import { GitlabContextParser } from "./gitlab-context-parser";
import { GitlabRepositoryProvider } from "./gitlab-repository-provider";
import { GitLabTokenHelper } from "./gitlab-token-helper";
import { GitLabTokenValidator } from "./gitlab-token-validator";
import { GitlabLanguagesProvider } from "./languages-provider";

export const gitlabContainerModule = new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(RepositoryHost).toSelf().inSingletonScope();
    bind(GitLabApi).toSelf().inSingletonScope();
    bind(GitlabContextParser).toSelf().inSingletonScope();
    bind(GitLabAuthProvider).toSelf().inSingletonScope();
    bind(AuthProvider).toService(GitLabAuthProvider)
    bind(GitlabFileProvider).toSelf().inSingletonScope();
    bind(FileProvider).toService(GitlabFileProvider);
    bind(GitlabLanguagesProvider).toSelf().inSingletonScope();
    bind(LanguagesProvider).toService(GitlabLanguagesProvider);
    bind(GitlabRepositoryProvider).toSelf().inSingletonScope();
    bind(RepositoryProvider).toService(GitlabRepositoryProvider);
    bind(IContextParser).toService(GitlabContextParser);
    bind(GitLabTokenHelper).toSelf().inSingletonScope();
    bind(GitLabTokenValidator).toSelf().inSingletonScope();
    bind(IGitTokenValidator).toService(GitLabTokenValidator);
});
