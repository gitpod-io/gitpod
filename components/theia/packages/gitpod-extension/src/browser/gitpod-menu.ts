/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { MenuModelRegistry, Disposable, MenuAction, MenuPath } from "@theia/core";
import { WorkspaceCommands } from "@theia/workspace/lib/browser";

@injectable()
export class GitpodMenuModelRegistry extends MenuModelRegistry {

    registerMenuAction(menuPath: MenuPath, item: MenuAction): Disposable {
        if (item.commandId === WorkspaceCommands.OPEN.id) {
            return Disposable.NULL;
        }
        return super.registerMenuAction(menuPath, item);
    }
}