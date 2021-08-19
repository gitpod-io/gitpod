/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import EventEmitter from 'events';
import { useEffect, useRef } from 'react';
import { Terminal, ITerminalOptions, ITheme } from 'xterm';
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css';

export interface WorkspaceLogsProps {
  logsEmitter: EventEmitter;
  errorMessage?: string;
  classes?: string;
}

export default function WorkspaceLogs(props: WorkspaceLogsProps) {
  const xTermParentRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal>();
  const fitAddon = new FitAddon();

  useEffect(() => {
    if (!xTermParentRef.current) {
      return;
    }
    const theme: ITheme = {};
    const options: ITerminalOptions = {
      cursorBlink: false,
      disableStdin: true,
      fontSize: 14,
      theme,
      scrollback: 9999999,
    };
    const terminal = new Terminal(options);
    terminalRef.current = terminal;
    terminal.loadAddon(fitAddon);
    terminal.open(xTermParentRef.current);
    props.logsEmitter.on('logs', logs => {
      if (fitAddon && terminal && logs) {
        terminal.write(logs);
      }
    });
    fitAddon.fit();
    return function cleanUp() {
      terminal.dispose();
    }
  });

  useEffect(() => {
    // Fit terminal on window resize (debounced)
    let timeout: NodeJS.Timeout | undefined;
    const onWindowResize = () => {
      clearTimeout(timeout!);
      timeout = setTimeout(() => fitAddon!.fit(), 20);
    };
    window.addEventListener('resize', onWindowResize);
    return function cleanUp() {
      clearTimeout(timeout!);
      window.removeEventListener('resize', onWindowResize);
    }
  });

  useEffect(() => {
    if (terminalRef.current && props.errorMessage) {
      terminalRef.current.write(`\n\u001b[38;5;196m${props.errorMessage}\u001b[0m`);
    }
  }, [ terminalRef.current, props.errorMessage ]);

  return <div className={`mt-6 ${props.classes || 'h-72 w-11/12 lg:w-3/5'} rounded-xl bg-black relative`}>
    <div className="absolute top-0 left-0 bottom-0 right-0 m-6" ref={xTermParentRef}></div>
  </div>;
}
