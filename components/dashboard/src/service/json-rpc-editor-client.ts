/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { CallOptions, PromiseClient } from "@connectrpc/connect";
import { PartialMessage } from "@bufbuild/protobuf";
import { EditorService } from "@gitpod/public-api/lib/gitpod/v1/editor_connect";
import {
    GetEditorInstallationStepsRequest,
    GetEditorInstallationStepsResponse,
    ListEditorsRequest,
    ListEditorsResponse,
} from "@gitpod/public-api/lib/gitpod/v1/editor_pb";
import { getGitpodService } from "./service";
import { converter } from "./public-api";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

export class JsonRpcEditorClient implements PromiseClient<typeof EditorService> {
    async listEditors(
        _request: PartialMessage<ListEditorsRequest>,
        _options?: CallOptions | undefined,
    ): Promise<ListEditorsResponse> {
        const result = await getGitpodService().server.getIDEOptions();
        return new ListEditorsResponse({
            editors: Object.entries(result.options).map(([id, editor]) => converter.toEditor(id, editor)),
        });
    }

    async getEditorInstallationSteps(
        request: PartialMessage<GetEditorInstallationStepsRequest>,
        _options?: CallOptions | undefined,
    ): Promise<GetEditorInstallationStepsResponse> {
        if (!request.editor || !request.editor.name) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "editor is required");
        }
        const result = await getGitpodService().server.getIDEOptions();
        return new GetEditorInstallationStepsResponse({
            steps: converter.toEditorInstallationSteps(request.editor.name, request.editor.version, result.clients),
        });
    }
}
