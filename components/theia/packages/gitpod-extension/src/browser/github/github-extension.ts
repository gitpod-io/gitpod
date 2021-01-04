/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { GitHosterExtension } from "../githoster/githoster-extension";

export const GITHUB_ID = "GitHub";

@injectable()
export class GitHubExtension extends GitHosterExtension {
    get name() {
        return GITHUB_ID;
    }
}
