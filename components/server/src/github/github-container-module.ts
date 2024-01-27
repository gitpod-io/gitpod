/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";
import { AuthProvider } from "../auth/auth-provider";
import { FileProvider, RepositoryProvider, RepositoryHost } from "../repohost";
import { IContextParser } from "../workspace/context-parser";
import { GitHubGraphQlEndpoint, GitHubRestApi } from "./api";
import { GithubFileProvider } from "./file-provider";
import { GitHubAuthProvider } from "./github-auth-provider";
import { GithubContextParser } from "./github-context-parser";
import { GithubRepositoryProvider } from "./github-repository-provider";
import { GitHubTokenHelper } from "./github-token-helper";
import { IGitTokenValidator } from "../workspace/git-token-validator";
import { GitHubTokenValidator } from "./github-token-validator";
import { RepositoryService } from "../repohost/repo-service";
import { GitHubService } from "../prebuilds/github-service";

export const githubContainerModule = new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bind(RepositoryHost).toSelf().inSingletonScope();
    bind(GitHubRestApi).toSelf().inSingletonScope();
    bind(GitHubGraphQlEndpoint).toSelf().inSingletonScope();
    bind(GithubFileProvider).toSelf().inSingletonScope();
    bind(FileProvider).toService(GithubFileProvider);
    bind(GitHubAuthProvider).toSelf().inSingletonScope();
    bind(AuthProvider).toService(GitHubAuthProvider);
    bind(GithubRepositoryProvider).toSelf().inSingletonScope();
    bind(RepositoryProvider).toService(GithubRepositoryProvider);
    bind(GithubContextParser).toSelf().inSingletonScope();
    bind(IContextParser).toService(GithubContextParser);
    bind(GitHubTokenHelper).toSelf().inSingletonScope();
    bind(GitHubTokenValidator).toSelf().inSingletonScope();
    bind(IGitTokenValidator).toService(GitHubTokenValidator);
    rebind(RepositoryService).to(GitHubService).inSingletonScope();
});
