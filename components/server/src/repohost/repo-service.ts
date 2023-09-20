/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ProviderRepository, User } from "@gitpod/gitpod-protocol";
import { injectable } from "inversify";
import { CancellationToken } from "vscode-jsonrpc";

@injectable()
export class RepositoryService {
    async getRepositoriesForAutomatedPrebuilds(
        user: User,
        params: { searchString?: string; limit?: number; maxPages?: number; cancellationToken?: CancellationToken },
    ): Promise<ProviderRepository[]> {
        return [];
    }

    async canInstallAutomatedPrebuilds(user: User, cloneUrl: string): Promise<boolean> {
        return false;
    }

    async installAutomatedPrebuilds(user: User, cloneUrl: string): Promise<string> {
        throw new Error("unsupported");
    }

    async uninstallAutomatedPrebuilds(user: User, cloneUrl: string, webhookId: string): Promise<void> {
        throw new Error("unsupported");
    }
}
