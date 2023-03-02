/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ServiceImpl, ConnectError, Code } from "@bufbuild/connect";
import { experimental } from "@gitpod/public-api";

export class WorkspacesService implements ServiceImpl<typeof experimental.WorkspacesService> {
    async createWorkspace(req: experimental.CreateWorkspaceRequest): Promise<experimental.CreateWorkspaceResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
}
