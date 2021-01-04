/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from 'inversify';
import { ThemeService } from '@theia/core/lib/browser/theming';
import * as Cookies from 'js-cookie';
import { getGitpodService } from './utils';
import { MonacoThemeJson, MonacoThemingService } from '@theia/monaco/lib/browser/monaco-theming-service';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { CommonFrontendContribution } from '@theia/core/lib/browser';
import { ColorRegistry } from '@theia/core/lib/browser/color-registry';
import { ColorApplicationContribution } from '@theia/core/lib/browser/color-application-contribution';
import { MonacoThemeRegistry } from '@theia/monaco/lib/browser/textmate/monaco-theme-registry';

type MonacoThemeState = import('@theia/monaco/lib/browser/monaco-indexed-db').MonacoThemeState;

const currentThemeStorageUri = 'data://current-theme';

@injectable()
export class GitpodCommonFrontendContribution extends CommonFrontendContribution {

    @inject(ColorRegistry)
    protected readonly colorRegistry: ColorRegistry;

    @inject(ColorApplicationContribution)
    protected readonly colorContribution: ColorApplicationContribution;

    @inject(MonacoThemeRegistry)
    protected readonly monacoThemeRegistry: MonacoThemeRegistry;

    async configure(): Promise<void> {
        const id = await this.restoreUserTheme();
        if (id) {
            ThemeService.get().setCurrentTheme(id);
        } else {
            this.storeUserTheme();
            this.setThemeCookie();
        }
        ThemeService.get().onThemeChange(() => this.storeUserTheme());
        this.colorContribution.onDidChange(() => this.setThemeCookie());
        // override from user settigns
        return super.configure();
    }

    protected setThemeCookie(): void {
        const theme = ThemeService.get().getCurrentTheme();
        const domain = new GitpodHostUrl(window.location.href).withoutWorkspacePrefix().url.host;
        const foreseeableFuture = Date.now() + 1000 * 24 * 60 * 60 * 1000; // 1000 days
        Cookies.set('theme', {
            id: theme.id,
            mode: theme.type,
            colors: {
                brand: this.colorRegistry.getCurrentColor('button.background'),
                brand2: this.colorRegistry.getCurrentColor('button.hoverBackground'),
                background1: this.colorRegistry.getCurrentColor('editor.background'),
                background2: this.colorRegistry.getCurrentColor('editorWidget.background'),
                background3: this.colorRegistry.getCurrentColor('tab.unfocusedActiveBackground'),
                paperShadow: this.colorRegistry.getCurrentColor('widget.shadow'),
                fontColor1: this.colorRegistry.getCurrentColor('editor.foreground'),
                fontColor2: this.colorRegistry.getCurrentColor('editorWidget.foreground'),
                fontColor3: this.colorRegistry.getCurrentColor('tab.unfocusedInactiveForeground'),
                disabled: this.colorRegistry.getCurrentColor('button.disabledBackground'),
            }
        }, { domain, expires: foreseeableFuture });
    }

    protected async storeUserTheme(): Promise<void> {
        const theme = ThemeService.get().getCurrentTheme();
        try {
            const editorTheme = theme.editorTheme || MonacoThemeRegistry.DARK_DEFAULT_THEME;
            const data = this.monacoThemeRegistry.getThemeData(editorTheme);
            if (data) {
                const state: MonacoThemeState = {
                    id: theme.id,
                    label: theme.label,
                    description: theme.description,
                    uiTheme: theme.type === 'light' ? 'vs' : theme.type === 'dark' ? 'vs-dark' : 'hc-black',
                    data
                };
                await getGitpodService().server.updateUserStorageResource({
                    uri: currentThemeStorageUri,
                    content: JSON.stringify(state)
                });
            }
        } catch (e) {
            console.error(`Failed to store "${theme.id}" user theme `, e);
        }
    }

    protected async restoreUserTheme(): Promise<string | undefined> {
        let currentId;
        try {
            const existingThemeFromCookie = Cookies.getJSON('theme');
            if (!existingThemeFromCookie) {
                return undefined;
            }
            if (typeof existingThemeFromCookie === 'string') {
                // legacy
                return existingThemeFromCookie;
            }
            currentId = existingThemeFromCookie.id;
            if (ThemeService.get().getTheme(currentId).id === currentId) {
                // already loaded from the indexed db (local cache)
                return currentId;
            }
            const content = await getGitpodService().server.getUserStorageResource({ uri: currentThemeStorageUri });
            if (ThemeService.get().getTheme(currentId).id === currentId) {
                // already loaded by the plugin (up-to-date version)
                return currentId;
            }
            if (content) {
                const state = JSON.parse(content) as MonacoThemeJson | MonacoThemeState;
                const id = state.id || state.label;
                if (id === currentId) {
                    if ('json' in state) {
                        // legacy
                        MonacoThemingService.register(state);
                    } else {
                        MonacoThemeRegistry.SINGLETON.setTheme(state.data.name!, state.data);
                        MonacoThemingService['doRegister'](state);
                    }
                    return id;
                } else {
                    console.error("Theme didn't match. Expected " + currentId + " but was " + id);
                }
            }
        } catch (e) {
            console.error(`Failed to restore "${currentId}" user theme:`, e);
        }
        return undefined;
    }

}
