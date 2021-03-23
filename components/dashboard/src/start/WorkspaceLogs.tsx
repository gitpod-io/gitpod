/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import EventEmitter from 'events';
import React from 'react';
import { Terminal, ITerminalOptions, ITheme } from 'xterm';
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css';
import { DisposableCollection } from '@gitpod/gitpod-protocol';

export interface WorkspaceLogsProps {
  logsEmitter: EventEmitter;
}

export interface WorkspaceLogsState {
}

export default class WorkspaceLogs extends React.Component<WorkspaceLogsProps, WorkspaceLogsState> {
  protected xTermParentRef: React.RefObject<HTMLDivElement>;
  protected terminal: Terminal | undefined;
  protected fitAddon: FitAddon | undefined;
  
  constructor(props: WorkspaceLogsProps) {
    super(props);
    this.xTermParentRef = React.createRef();
  }

  private readonly toDispose = new DisposableCollection();
  componentDidMount() {
    const element = this.xTermParentRef.current;
    if (element === null) {
      return;
    }
    const theme: ITheme = {
      // background: '#F5F5F4',
    };
    const options: ITerminalOptions = {
      cursorBlink: false,
      disableStdin: true,
      fontSize: 14,
      theme,
      scrollback: 9999999,
    };
    this.terminal = new Terminal(options);
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(element);
    this.props.logsEmitter.on('logs', logs => {
      if (this.fitAddon && this.terminal && logs) {
        this.terminal.write(logs);
      }
    });
    this.toDispose.push(this.terminal);
    this.fitAddon.fit();

    // Fit terminal on window resize (debounced)
    let timeout: NodeJS.Timeout | undefined;
    const onWindowResize = () => {
      clearTimeout(timeout!);
      timeout = setTimeout(() => this.fitAddon!.fit(), 20);
    };
    window.addEventListener('resize', onWindowResize);
    this.toDispose.push({
      dispose: () => {
        clearTimeout(timeout!);
        window.removeEventListener('resize', onWindowResize);
      }
    });
  }

  componentWillUnmount() {
    this.toDispose.dispose();
  }

  render() {
    return <div className="mt-6 h-72 w-11/12 lg:w-3/5 rounded-xl bg-black p-6">
      <div className="h-full w-full" ref={this.xTermParentRef}></div>
    </div>;
  }
}