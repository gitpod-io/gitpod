/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { ConnectRouter } from "@bufbuild/connect";
import { WorkspacesService as WorkspacesServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/workspaces_connectweb";
import { inject, injectable } from "inversify";
import { WorkspacesService } from "./workspaces";

@injectable()
export class Router {
    @inject(WorkspacesService)
    protected workspaces: WorkspacesService;

    public routes(router: ConnectRouter) {
        router.service(WorkspacesServiceDefinition, this.workspaces);
    }
}
