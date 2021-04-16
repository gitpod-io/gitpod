/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AbstractDialog, Message } from "@theia/core/lib/browser";
import { UserMessage } from "@gitpod/gitpod-protocol";
import { PreviewHandlerProvider } from "@theia/preview/lib/browser";
import URI from "@theia/core/lib/common/uri";

export class UserMessageDialog extends AbstractDialog<boolean> {
    value = true;
    protected currentMessage: number;
    protected previousButton: HTMLButtonElement;
    protected nextButton: HTMLButtonElement;
    protected markdownContainer: HTMLDivElement;

    constructor(protected messages: UserMessage[], protected previewHandlerProvider: PreviewHandlerProvider) {
        super({ title: messages[0].title || '' });
        this.previousButton = super.createButton('Previous');
        this.previousButton.onclick = () => {
            this.render(this.currentMessage + 1);
        }
        this.controlPanel.appendChild(this.previousButton);
        this.nextButton = super.createButton('Next');
        this.nextButton.onclick = () => {
            this.render(this.currentMessage - 1);
        }
        this.controlPanel.appendChild(this.nextButton);
        this.render(0);
    }

    protected async render(messageNr: number) {
        if (messageNr < 0 || messageNr >= this.messages.length) {
            return;
        }
        this.currentMessage = messageNr;
        // update title
        this.titleNode.textContent = this.messages[messageNr].title || '';
        // update contents
        const message = this.messages[this.currentMessage];
        this.contentNode.innerHTML = '';
        if (message.url) {
            const uri = new URI(message.url);
            const handler = this.previewHandlerProvider.findContribution(uri);
            if (handler[0]) {
                const response = await fetch(uri.toString());
                const mdContent = await response.text()!;
                const node = await handler[0].renderContent({ content: mdContent, originUri: uri });
                if (node) {
                    node.style.overflowY = 'auto';
                    node.style.padding = '20px';
                    node.style.paddingTop = '0px';
                    this.contentNode.appendChild(node);
                }
            } else {
                console.error('Could not find renderer for uri ', uri);
            }
        } else if (message.content) {
            this.contentNode.innerHTML = message.content;
        }
        // update buttons
        this.nextButton.style.display = '';
        this.previousButton.style.display = '';
        if (this.currentMessage === 0) {
            this.nextButton.style.display = 'none';
        }
        if (this.currentMessage + 1 === this.messages.length) {
            this.previousButton.style.display = 'none';
        }
    }

    protected onAfterAttach(msg: Message): void {
        this.appendCloseButton('Ok');
        super.onAfterAttach(msg);
    }

    close(): void {
        if (this.resolve) {
            this.resolve(this.value);
        }
        super.close();
    }
}

export namespace UserMessageDialog {
    export const USER_MESSAGE_CLASS = "user-message";
}