/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { EditorService as EditorServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/editor_connect";
import { inject, injectable } from "inversify";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { ListEditorsRequest, ListEditorsResponse } from "@gitpod/public-api/lib/gitpod/v1/editor_pb";
import { IDEService } from "../ide-service";
import { UserService } from "../user/user-service";
import { ctxUserId } from "../util/request-context";
import { getPrimaryEmail } from "@gitpod/public-api-common/lib/user-utils";

@injectable()
export class EditorServiceAPI implements ServiceImpl<typeof EditorServiceInterface> {
    @inject(IDEService) private readonly ideService: IDEService;
    @inject(UserService) private readonly userService: UserService;
    @inject(PublicAPIConverter) private readonly apiConverter: PublicAPIConverter;

    async listEditors(_req: ListEditorsRequest, _: HandlerContext): Promise<ListEditorsResponse> {
        const user = await this.userService.findUserById(ctxUserId(), ctxUserId());
        const email = getPrimaryEmail(user);
        const ideConfig = await this.ideService.getIDEConfig({ user: { id: user.id, email } });
        return new ListEditorsResponse({
            editors: Object.entries(ideConfig.ideOptions.options).map(([id, editor]) =>
                this.apiConverter.toEditor(id, editor),
            ),
        });
    }
}
