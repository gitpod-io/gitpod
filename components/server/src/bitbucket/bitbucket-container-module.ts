/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";
import { AuthProvider } from "../auth/auth-provider";
import { FileProvider, RepositoryHost, RepositoryProvider } from "../repohost";
import { IContextParser } from "../workspace/context-parser";
import { IGitTokenValidator } from "../workspace/git-token-validator";
import { BitbucketApiFactory } from "./bitbucket-api-factory";
import { BitbucketAuthProvider } from "./bitbucket-auth-provider";
import { BitbucketContextParser } from "./bitbucket-context-parser";
import { BitbucketFileProvider } from "./bitbucket-file-provider";
import { BitbucketRepositoryProvider } from "./bitbucket-repository-provider";
import { BitbucketTokenHelper } from "./bitbucket-token-handler";
import { BitbucketTokenValidator } from "./bitbucket-token-validator";
import { RepositoryService } from "../repohost/repo-service";
import { BitbucketService } from "../prebuilds/bitbucket-service";

export const bitbucketContainerModule = new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bind(RepositoryHost).toSelf().inSingletonScope();
    bind(BitbucketApiFactory).toSelf().inSingletonScope();
    bind(BitbucketFileProvider).toSelf().inSingletonScope();
    bind(FileProvider).toService(BitbucketFileProvider);
    bind(BitbucketContextParser).toSelf().inSingletonScope();
    bind(IContextParser).toService(BitbucketContextParser);
    bind(BitbucketRepositoryProvider).toSelf().inSingletonScope();
    bind(RepositoryProvider).toService(BitbucketRepositoryProvider);
    bind(BitbucketAuthProvider).toSelf().inSingletonScope();
    bind(AuthProvider).to(BitbucketAuthProvider).inSingletonScope();
    bind(BitbucketTokenHelper).toSelf().inSingletonScope();
    bind(BitbucketTokenValidator).toSelf().inSingletonScope();
    bind(IGitTokenValidator).toService(BitbucketTokenValidator);
    rebind(RepositoryService).to(BitbucketService).inSingletonScope();
});
