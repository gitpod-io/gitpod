/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from "react";
import * as ReactDOM from "react-dom";
import { inject, injectable, postConstruct } from 'inversify';

import { AboutDialogProps, AboutDialog } from '@theia/core/lib/browser/about-dialog';
import { Disposable } from '@theia/core';
import { Message } from "@phosphor/messaging";
import { GitpodAboutView } from "./gitpod-about-view";
import { GitpodBranding } from "./gitpod-branding";
import { Branding } from "@gitpod/gitpod-protocol";
import { GitpodInfoService } from "../common/gitpod-info";

export const ABOUT_CONTENT_CLASS = 'theia-aboutDialog';
export const ABOUT_EXTENSIONS_CLASS = 'theia-aboutExtensions';

@injectable()
export class GitpodAboutDialogProps extends AboutDialogProps {
}

@injectable()
export class GitpodAboutDialog extends AboutDialog {

    protected readonly okButton: HTMLButtonElement;

    @inject(GitpodBranding) protected readonly gitpodBranding: GitpodBranding;
    @inject(GitpodInfoService) protected readonly infoService: GitpodInfoService;

    protected branding: Branding | undefined;
    protected host: string;

    constructor(
        @inject(GitpodAboutDialogProps) protected readonly props: GitpodAboutDialogProps
    ) {
        super({
            title: props.title
        });
    }

    @postConstruct()
    protected async init(): Promise<void> {
        this.controlPanel.parentElement!.removeChild(this.controlPanel);
        this.toDispose.push(Disposable.create(() => ReactDOM.unmountComponentAtNode(this.contentNode)));
        this.branding = await this.gitpodBranding.branding;
        this.host = (await this.infoService.getInfo()).host;
    }

    protected onActivateRequest(msg: Message): void {
        this.update();
    }

    protected onUpdateRequest(msg: Message): void {
        ReactDOM.render(<GitpodAboutView branding={this.branding} host={this.host} />, this.contentNode);
    }
}
