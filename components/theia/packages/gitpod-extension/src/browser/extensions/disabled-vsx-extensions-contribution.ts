/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { VSXExtensionsContribution, VSXExtensionsCommands } from '@theia/vsx-registry/lib/browser/vsx-extensions-contribution';
import { VSXExtensionsViewContainer } from '@theia/vsx-registry/lib/browser/vsx-extensions-view-container';
import { OpenViewArguments, Widget } from '@theia/core/lib/browser';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { KeybindingRegistry } from '@theia/core/lib/browser/keybinding';
import { EXTENSIONS_VIEW_CONTAINER_ID } from './extensions-view-contribution';

/**
 * We contribute our own view (ExtensionsViewContribution), so we disable the one
 * shipped with Theia to avoid duplicate commands and menu entries.
 */
export class DisabledVSXExtensionsContribution extends VSXExtensionsContribution {

    async initializeLayout(): Promise<void> {
        // no-op
    }

    openView(args?: Partial<OpenViewArguments>): Promise<VSXExtensionsViewContainer> {
        return Promise.reject(new Error('VSXExtensionsContribution is disabled.'));
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(VSXExtensionsCommands.CLEAR_ALL, {
            execute: w => this.withWidget(w, () => this.model.search.query = ''),
            isEnabled: w => this.withWidget(w, () => !!this.model.search.query),
            isVisible: w => this.withWidget(w, () => true)
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        // no-op
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        // no-op
    }

    protected withWidget<T>(widget: Widget | undefined, fn: (widget: VSXExtensionsViewContainer) => T): T | false {
        if (!widget) {
            widget = this.widgetManager.tryGetWidget(EXTENSIONS_VIEW_CONTAINER_ID);
        }
        if (widget instanceof VSXExtensionsViewContainer && widget.id === EXTENSIONS_VIEW_CONTAINER_ID) {
            return fn(widget);
        }
        return false;
    }

}
