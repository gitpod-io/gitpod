/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { Command } from "@theia/core";
import { AbstractViewContribution, FrontendApplication } from "@theia/core/lib/browser";
import { ReviewConversationMarker } from "../review-conversation";
import { ReviewConversationWidget } from "./review-conversation-widget";

export namespace PullRequestReviewCommentMarkerCommands {
    export const toggle: Command = {
        id: 'reviewConversation:toggle'
    }
}

@injectable()
export class ReviewConversationContribution extends AbstractViewContribution<ReviewConversationWidget> {

    constructor() {
        super({
            widgetId: ReviewConversationMarker.kind,
            widgetName: ReviewConversationWidget.label,
            defaultWidgetOptions: {
                area: 'bottom'
            },
            toggleCommandId: PullRequestReviewCommentMarkerCommands.toggle.id,
            toggleKeybinding: 'ctrlcmd+shift+c'
        });
    }

    initializeLayout(app: FrontendApplication): Promise<void> {
        return Promise.resolve();
    }

}
