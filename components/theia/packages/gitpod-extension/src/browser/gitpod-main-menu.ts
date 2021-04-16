/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { BrowserMainMenuFactory, MenuBarWidget } from '@theia/core/lib/browser/menu/browser-menu-plugin';

@injectable()
export class GitpodMainMenuFactory extends BrowserMainMenuFactory {

    protected menuBar: MenuBarWidget | undefined;
    createMenuBar(): MenuBarWidget {
        this.menuBar = super.createMenuBar();
        return this.menuBar;
    }

    update() {
        if (this.menuBar) {
            this.menuBar.clearMenus();
            this.fillMenuBar(this.menuBar);
        }
    }
}