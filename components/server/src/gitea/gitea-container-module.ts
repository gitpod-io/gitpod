/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";
import { AuthProvider } from "../auth/auth-provider";
import { FileProvider, LanguagesProvider, RepositoryProvider, RepositoryHost } from "../repohost";
import { IContextParser } from "../workspace/context-parser";
import { GiteaRestApi } from "./api";
import { GiteaFileProvider } from "./file-provider";
import { GiteaAuthProvider } from "./gitea-auth-provider";
import { GiteaContextParser } from "./gitea-context-parser";
import { GiteaRepositoryProvider } from "./gitea-repository-provider";
import { GiteaTokenHelper } from "./gitea-token-helper";
import { GiteaLanguagesProvider } from "./languages-provider";
import { IGitTokenValidator } from "../workspace/git-token-validator";
import { GiteaTokenValidator } from "./gitea-token-validator";

export const giteaContainerModule = new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(RepositoryHost).toSelf().inSingletonScope();
    bind(GiteaRestApi).toSelf().inSingletonScope();
    bind(GiteaFileProvider).toSelf().inSingletonScope();
    bind(FileProvider).toService(GiteaFileProvider);
    bind(GiteaAuthProvider).toSelf().inSingletonScope();
    bind(AuthProvider).toService(GiteaAuthProvider);
    bind(GiteaLanguagesProvider).toSelf().inSingletonScope();
    bind(LanguagesProvider).toService(GiteaLanguagesProvider);
    bind(GiteaRepositoryProvider).toSelf().inSingletonScope();
    bind(RepositoryProvider).toService(GiteaRepositoryProvider);
    bind(GiteaContextParser).toSelf().inSingletonScope();
    bind(IContextParser).toService(GiteaContextParser);
    bind(GiteaTokenHelper).toSelf().inSingletonScope();
    bind(GiteaTokenValidator).toSelf().inSingletonScope();
    bind(IGitTokenValidator).toService(GiteaTokenValidator);
});
