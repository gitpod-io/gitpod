/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { injectable } from "inversify";

@injectable()
export class RepositoryService {

    async canInstallAutomatedPrebuilds(user: User, cloneUrl: string): Promise<boolean> {
        return false;
    }

    async installAutomatedPrebuilds(user: User, cloneUrl: string): Promise<void> {
        throw new Error('unsupported');
    }

}