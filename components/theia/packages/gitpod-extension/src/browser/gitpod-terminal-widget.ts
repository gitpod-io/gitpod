/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { TerminalWidgetImpl } from '@theia/terminal/lib/browser/terminal-widget-impl';
import { injectable } from 'inversify';
import { Terminal } from 'xterm';
import { Disposable } from '@theia/core';

@injectable()
export class GitpodTerminalWidget extends TerminalWidgetImpl {

    constructor() {
        super();
        this.installLinkHandler();
    }

    protected installLinkHandler(): void {
        const term = (this as any).term as Terminal;
        if (term && term.registerLinkMatcher) {
            const gitpodTerminalLinkHandler = GitpodTerminalWidget.createLinkHandler();
            const options = {
                matchIndex: 1, //index of the regex capture group
            };
            const matcherId = term.registerLinkMatcher(GitpodTerminalWidget.modifiedUrlRegex, gitpodTerminalLinkHandler, options);
            this.toDispose.push(Disposable.create(
                () => {
                    term.deregisterLinkMatcher(matcherId);
                }
            ));
            this.logger.trace("Registered Gitpod xTerm LinkMatcher.");
        }
    }

}

export namespace GitpodTerminalWidget {

    export type LinkMatcherHandler = (event: MouseEvent, uri: string) => boolean | void;
    export type LinkMatcherValidationCallback = (uri: string, callback: (isValid: boolean) => void) => void;

    // Source: https://github.com/xtermjs/xterm.js/tree/master/src/Linkifier.ts
    const protocolClause = '(https?:\\/\\/)';
    const domainCharacterSet = '[\\da-z\\.-]+';
    const negatedDomainCharacterSet = '[^\\da-z\\.-]+';
    const domainBodyClause = '(' + domainCharacterSet + ')';
    const tldClause = '([a-z\\.]{2,6})';
    const ipClause = '((\\d{1,3}\\.){3}\\d{1,3})';
    const localHostClause = '(localhost)';
    const portClause = '(:\\d{1,5})';
    const hostClause = '((' + domainBodyClause + '\\.' + tldClause + ')|' + ipClause + '|' + localHostClause + ')' + portClause + '?';
    const pathClause = '(\\/[\\/\\w\\.\\-%~]*)*';
    const queryStringHashFragmentCharacterSet = '[0-9\\w\\[\\]\\(\\)\\/\\?\\!#@$%&\'*+,:;~\\=\\.\\-]*';
    const queryStringClause = '(\\?' + queryStringHashFragmentCharacterSet + ')?';
    const hashFragmentClause = '(#' + queryStringHashFragmentCharacterSet + ')?';
    // const negatedPathCharacterSet = '[^\\/\\w\\.\\-%]+';
    const bodyClause = hostClause + pathClause + queryStringClause + hashFragmentClause;
    const start = '(?:^|' + negatedDomainCharacterSet + ')(';
    const end = ')';    // old: ')($|' + negatedPathCharacterSet + ')';     // What is this for? The regex is not correct, it eats the ':<port>' part
    export const modifiedUrlRegex = new RegExp(start + protocolClause + bodyClause + end);

    export function createLinkHandler(): LinkMatcherHandler {
        return (event: MouseEvent, uri: string): void => {
            openUri(uri);
        }
    }

    function determineTargetPort(url: URL | Location): string {
        if (!url.port) {
            return url.protocol === 'https:' ? '443' : '80';
        }
        return url.port;
    }

    export function toURL(uri: string): URL | undefined {
        let url;
        try {
            if (!uri.startsWith("http")) {
                uri = "http://" + uri;
            }
            url = new URL(uri);
        } catch (err) {
            console.error(err);
            return undefined;
        }

        if (url.hostname === 'localhost' ||
            url.hostname === '127.0.0.1' ||
            url.hostname === '0.0.0.0') {
            // We are currently at: <wsid>.ws.gitpod.io/
            // Port available under: <port>-<wsid>.ws.gitpod.io/...
            url.hostname = `${determineTargetPort(url)}-${window.location.hostname}`;
            url.protocol = window.location.protocol;
            url.port = determineTargetPort(window.location);
        }
        return url;
    }

    export function openUri(uri: string): void {
        const url = toURL(uri);
        if (url) {
            window.open(url.href, `_blank`, 'noopener');
        }
    }

}
