/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { AbstractViewContribution } from "@theia/core/lib/browser/shell/view-contribution";
import { FrontendApplicationContribution, FrontendApplication } from "@theia/core/lib/browser/frontend-application";
import { GitpodPluginService } from "../../common/gitpod-plugin-service";
import { PreferenceService } from "@theia/core/lib/browser/preferences/preference-service";
import { ViewContainer } from "@theia/core/lib/browser/view-container";
import { GitpodServiceProvider } from "../gitpod-service-provider";

export const EXTENSIONS_VIEW_CONTAINER_ID = 'gitpod-extensions-view-container';
export const EXTENSIONS_VIEW_CONTAINER_LABEL = 'Extensions';

@injectable()
export class ExtensionsViewContribution extends AbstractViewContribution<ViewContainer> implements FrontendApplicationContribution {

    @inject(GitpodPluginService)
    protected readonly pluginService: GitpodPluginService;

    @inject(PreferenceService)
    protected readonly preferencService: PreferenceService;

    @inject(GitpodServiceProvider)
    protected readonly serviceProvider: GitpodServiceProvider;

    constructor() {
        super({
            widgetId: EXTENSIONS_VIEW_CONTAINER_ID,
            widgetName: EXTENSIONS_VIEW_CONTAINER_LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 500
            },
            toggleCommandId: 'extensionsView:toggle',
            toggleKeybinding: 'ctrlcmd+shift+x'
        });
    }

    initializeLayout(): Promise<void> {
        return this.openView() as any;
    }


    async onStart(app: FrontendApplication) {
        // trigger initialization
        this.pluginService.getUploadUri();
        this.serviceProvider.getService().server.onDidOpenConnection(() =>
            this.pluginService.deploy()
        );
    }

}