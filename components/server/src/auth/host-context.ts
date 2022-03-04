/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable, optional} from "inversify";
import { AuthProvider } from "./auth-provider";
import { RepositoryHost } from "../repohost/repository-host";
import { IContextParser } from "../workspace/context-parser";
import { IGitTokenValidator } from "../workspace/git-token-validator";

@injectable()
export class HostContext {

    @inject(AuthProvider)
    readonly authProvider: AuthProvider;

    @inject(RepositoryHost) @optional()
    readonly services: RepositoryHost | undefined;

    @inject(IContextParser) @optional()
    readonly contextParser: IContextParser | undefined;

    @inject(IGitTokenValidator) @optional()
    readonly gitTokenValidator: IGitTokenValidator | undefined;
}