/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";
import { AuthProvider } from "../auth/auth-provider";
import { FileProvider, RepositoryProvider, RepositoryHost } from "../repohost";
import { IContextParser } from "../workspace/context-parser";
import { IGitTokenValidator } from "../workspace/git-token-validator";
import { AzureDevOpsApi } from "./azure-api";
import { AzureDevOpsFileProvider } from "./azure-file-provider";
import { AzureDevOpsAuthProvider } from "./azure-auth-provider";
import { AzureDevOpsContextParser } from "./azure-context-parser";
import { AzureDevOpsRepositoryProvider } from "./azure-repository-provider";
import { AzureDevOpsTokenHelper } from "./azure-token-helper";
import { AzureDevOpsTokenValidator } from "./azure-token-validator";

export const azureDevOpsContainerModule = new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bind(RepositoryHost).toSelf().inSingletonScope();
    bind(AzureDevOpsApi).toSelf().inSingletonScope();
    bind(AzureDevOpsFileProvider).toSelf().inSingletonScope();
    bind(FileProvider).toService(AzureDevOpsFileProvider);
    bind(AzureDevOpsContextParser).toSelf().inSingletonScope();
    bind(IContextParser).toService(AzureDevOpsContextParser);
    bind(AzureDevOpsRepositoryProvider).toSelf().inSingletonScope();
    bind(RepositoryProvider).toService(AzureDevOpsRepositoryProvider);
    bind(AuthProvider).toService(AzureDevOpsAuthProvider);
    bind(AzureDevOpsAuthProvider).toSelf().inSingletonScope();
    bind(AzureDevOpsTokenHelper).toSelf().inSingletonScope();
    bind(AzureDevOpsTokenValidator).toSelf().inSingletonScope();
    bind(IGitTokenValidator).toService(AzureDevOpsTokenValidator);
});
