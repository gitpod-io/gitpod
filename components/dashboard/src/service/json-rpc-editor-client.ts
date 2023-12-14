/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { CallOptions, PromiseClient } from "@connectrpc/connect";
import { PartialMessage } from "@bufbuild/protobuf";
import { EditorService } from "@gitpod/public-api/lib/gitpod/v1/editor_connect";
import { ListEditorsRequest, ListEditorsResponse } from "@gitpod/public-api/lib/gitpod/v1/editor_pb";
import { getGitpodService } from "./service";
import { converter } from "./public-api";

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
}
