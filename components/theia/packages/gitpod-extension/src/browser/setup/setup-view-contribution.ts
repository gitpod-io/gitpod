/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AbstractViewContribution, FrontendApplication, FrontendApplicationContribution, PreferenceService, PreferenceScope } from "@theia/core/lib/browser";
import { injectable, inject } from "inversify";
import { SetupView } from "./setup-view";
import { SetupManager } from "./setup-manager";
import { MessageService } from "@theia/core";
import { dontAskProperty } from "./setup-preferences";


@injectable()
export class SetupViewContribution extends AbstractViewContribution<SetupView> implements FrontendApplicationContribution {

    static TOGGLE_VIEW_ID = 'setupview:toggle';

    @inject(SetupManager) private readonly manager: SetupManager;
    @inject(MessageService) private readonly messageService: MessageService;
    @inject(PreferenceService) private readonly preferenceService: PreferenceService;

    constructor() {
        super({
            widgetId: SetupView.ID,
            widgetName: SetupView.LABEL,
            defaultWidgetOptions: {
                area: 'right',
                rank: 5000
            },
            toggleCommandId: SetupViewContribution.TOGGLE_VIEW_ID
        });
    }

    async onDidInitializeLayout(app: FrontendApplication) {
        await app.shell.pendingUpdates;
        await this.preferenceService.ready;
        if (this.preferenceService.get(dontAskProperty)) {
            return;
        }
        setTimeout(async () => {
            if (!await this.manager.hasConfig()) {
                const result = await this.messageService.info(
                    'This project could use a proper Gitpod configuration. Would you like some guidance?',
                    'Never Ask', 
                    'Setup Project');
                if (result === 'Setup Project') {
                    await this.openView({
                        activate: true,
                        reveal: true
                    });
                } else if (result === 'Never Ask') {
                    this.preferenceService.set(dontAskProperty, true, PreferenceScope.User);
                    this.messageService.info('Noted. You can start the Setup Assistant from the command palette (F1) at any time');
                }
            }
        }, 5000);
    }
}
