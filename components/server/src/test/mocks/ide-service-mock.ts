/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    GetConfigResponse,
    IDEServiceClient,
    ResolveWorkspaceConfigResponse,
    WorkspaceType,
} from "@gitpod/ide-service-api/lib/ide.pb";
import { injectable } from "inversify";
import { CallOptions } from "nice-grpc-common";

@injectable()
export class IDEServiceClientMock implements IDEServiceClient {
    getConfig(
        request: { user?: { id?: string | undefined; email?: string | undefined } | undefined },
        options?: CallOptions | undefined,
    ): Promise<GetConfigResponse> {
        throw new Error("Method not implemented.");
    }
    resolveWorkspaceConfig(
        request: {
            type?: WorkspaceType | undefined;
            context?: string | undefined;
            ideSettings?: string | undefined;
            workspaceConfig?: string | undefined;
            user?: { id?: string | undefined; email?: string | undefined } | undefined;
        },
        options?: CallOptions | undefined,
    ): Promise<ResolveWorkspaceConfigResponse> {
        throw new Error("Method not implemented.");
    }
}
