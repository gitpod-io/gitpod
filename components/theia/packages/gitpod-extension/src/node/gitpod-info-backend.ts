/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { GitpodInfo, GitpodInfoService } from "../common/gitpod-info";

@injectable()
export class GitpodInfoProviderNodeImpl implements GitpodInfoService {
    private info: GitpodInfo = {
        host: process.env.GITPOD_HOST || 'http://localhost:3000',
        // workspaceId: process.env.GITPOD_WORKSPACE_ID || 'a12-321', // Issue workspace
        workspaceId: process.env.GITPOD_WORKSPACE_ID || 'a12-345', // PR workspace
        instanceId: process.env.GITPOD_INSTANCE_ID || 'unknown',
        interval: parseInt(process.env.GITPOD_INTERVAL || '10000', 10),
        repoRoot: process.env.GITPOD_REPO_ROOT || 'undefined'
    }

    async getInfo() {
        return this.info;
    }

}