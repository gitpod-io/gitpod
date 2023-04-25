/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProvider, AuthProviderParams } from "./auth-provider";
import { IContextParser } from "../workspace/context-parser";
import { IGitTokenValidator } from "../workspace/git-token-validator";
import { RepositoryService } from "../repohost/repo-service";
import { FileProvider, RepositoryProvider } from "../repohost";

export interface HostContext extends HostServices {
    readonly config: AuthProviderParams;
    readonly host: string;
    readonly authCallbackPath: string;
}

export const HostServices = Symbol("HostServices");

export interface HostServices {
    readonly authProvider: AuthProvider;
    readonly contextParser?: IContextParser;
    readonly gitTokenValidator?: IGitTokenValidator;
    readonly fileProvider?: FileProvider;
    readonly repositoryProvider?: RepositoryProvider;
    readonly repositoryService?: RepositoryService;
}
