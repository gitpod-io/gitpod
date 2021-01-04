/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodService } from "@gitpod/gitpod-protocol";
import { injectable } from "inversify";
import { getGitpodService } from "./utils";

@injectable()
export class GitpodServiceProvider {

    /** why do we need it, we can just inject bind(GitpodService).toConstantValue and then inject it */
    getService(): GitpodService {
        return getGitpodService();
    }
}