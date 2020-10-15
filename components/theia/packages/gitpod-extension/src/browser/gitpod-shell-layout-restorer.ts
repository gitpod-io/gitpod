/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ILogger } from "@theia/core";
import { FrontendApplication, ShellLayoutRestorer, StorageService, WidgetManager } from "@theia/core/lib/browser";
import { Deferred } from "@theia/core/lib/common/promise-util";
import { inject, injectable } from "inversify";
import { GitpodServiceProvider } from "./gitpod-service-provider";
import { getWorkspaceID } from "./utils";

const workspaceIdPlaceHolder = '<§wsid$>';

function replaceAll(origin: string, replace: string, withThis: string): string {
    return origin.split(replace).join(withThis);
}

@injectable()
export class GitpodLayoutRestorer extends ShellLayoutRestorer {

    private layoutData = new Deferred<string | undefined>();
    protected application: FrontendApplication;

    constructor(
        @inject(WidgetManager) protected widgetManager: WidgetManager,
        @inject(ILogger) protected logger: ILogger,
        @inject(StorageService) protected storageService: StorageService,
        @inject(GitpodServiceProvider) protected serviceProvider: GitpodServiceProvider
    ) {
        super(widgetManager, logger, storageService);
        const service = this.serviceProvider.getService()
        const workspaceId = getWorkspaceID();
        service.server.getLayout(workspaceId).then(layout => {
            // update placeholders with new workspace id
            const replaced = layout && replaceAll(layout, workspaceIdPlaceHolder, workspaceId);
            this.layoutData.resolve(replaced);
        });

    }

    public captureLayout(): string {
        const layoutData = this.application.shell.getLayoutData();
        const layoutDataAsString = this.deflate(layoutData);
        // replace workspace id occurrences (e.g. preview) with ws id placeholder markers
        return replaceAll(layoutDataAsString, getWorkspaceID(), workspaceIdPlaceHolder);
    }

    public async restoreLayout(app: FrontendApplication): Promise<boolean> {
        this.application = app;
        const restored = await super.restoreLayout(app);
        if (!restored) {
            const serializedLayoutData = await this.layoutData.promise;
            if (!serializedLayoutData) {
                return false;
            }
            const layoutData = await this.inflate(serializedLayoutData);
            await app.shell.setLayoutData(layoutData);
            return true;
        }
        return restored;
    }

}
