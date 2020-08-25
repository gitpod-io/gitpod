/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { Terminal, ITerminalOptions, ITheme } from 'xterm';
import 'xterm/lib/xterm.css';
import { fit } from 'xterm/lib/addons/fit/fit';
import { colors } from '../withRoot';

export interface WorkspaceLogViewProps {
    content: string | undefined;
    errorMessage?: string;
}

export class WorkspaceLogView extends React.Component<WorkspaceLogViewProps, {}> {
    protected xTermParentRef: React.RefObject<HTMLDivElement>;
    protected terminal: Terminal | undefined;

    protected bottomLine: number = 0;
    protected isScrollToBottom = true;
    protected autoScroll = true;
    protected previousContent: string | undefined;

    constructor(props: WorkspaceLogViewProps) {
        super(props);
        this.xTermParentRef = React.createRef();
    }

    componentDidMount() {
        this.mountTerminal();
        this.updateTerminal();
    }

    componentDidUpdate() {
        this.mountTerminal();
        this.updateTerminal();
    }

    componentWillUnmount() {
        const term = this.terminal;
        if (term) {
            term.dispose();
        }
    }

    render() {
        return (
            <div className='log'>
                <div className='log-container'>
                    <div ref={this.xTermParentRef} className='xterm-log' />
                </div>
            </div>
        );
    }

    protected mountTerminal() {
        if (this.terminal) { return; }
        const element = this.xTermParentRef.current;

        if (element === null) { return; }
        this.terminal = this.createNewTerminal(element);
    }

    protected createNewTerminal(parent: HTMLElement) {
        let theme: ITheme = {
            foreground: colors.fontColor1,
            background: colors.background2,
            blue: '#83cded',
            cyan: '#5ac8aa',
            green: '#97bc22',
            // magenta: default,
            // red: default,
            yellow: '#f6a71e'
        }
        theme = {
            ...theme,
            brightBlue: theme.blue,
            brightCyan: theme.cyan,
            brightGreen: theme.green,
            brightMagenta: theme.magenta,
            brightRed: theme.red,
            brightYellow: theme.yellow
        }

        const options: ITerminalOptions = {
            allowTransparency: true,
            cursorBlink: false,
            disableStdin: true,
            theme: theme,
            fontWeight: 'normal',
            fontSize: 14
        };
        const term = new Terminal(options);
        term.open(parent);
        term.on('scroll', (evt) => {
            if (!this.isScrollToBottom) {
                this.autoScroll = false;
            }
        });
        return term;
    }

    protected updateTerminal() {
        const term = this.terminal;
        if (!term) {
            return;
        }

        fit(term);

        let newContent = this.props.content;
        if (newContent && this.props.errorMessage) {
            newContent += `\n${this.props.errorMessage}`;
        }

        if (!newContent) {
            // if there was no new text, don't do anything
            return;
        }
        if (newContent === this.previousContent) {
            // there was no change in content, don't to anything
            return;
        }
        this.previousContent = newContent;

        if (newContent.includes("\n")) {
            this.bottomLine += newContent.split("\n").length;
        }

        term.write(newContent);
        if (this.autoScroll) {
            this.isScrollToBottom = true;
            term.scrollToBottom();
            this.isScrollToBottom = false;
        }
    }

}