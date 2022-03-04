/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import EventEmitter from 'events';
import { useContext, useEffect, useRef } from 'react';
import { Terminal, ITerminalOptions, ITheme } from 'xterm';
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css';
import { ThemeContext } from '../theme-context';

const darkTheme: ITheme = {
  background: '#292524', // Tailwind's warmGray 800 https://tailwindcss.com/docs/customizing-colors
};
const lightTheme: ITheme = {
  background: '#F5F5F4', // Tailwind's warmGray 100 https://tailwindcss.com/docs/customizing-colors
  foreground: '#78716C', // Tailwind's warmGray 500 https://tailwindcss.com/docs/customizing-colors
  cursor: '#78716C', // Tailwind's warmGray 500 https://tailwindcss.com/docs/customizing-colors
}

export interface WorkspaceLogsProps {
  logsEmitter: EventEmitter;
  errorMessage?: string;
  classes?: string;
}

export default function WorkspaceLogs(props: WorkspaceLogsProps) {
  const xTermParentRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal>();
  const fitAddon = new FitAddon();
  const { isDark } = useContext(ThemeContext);

  useEffect(() => {
    if (!xTermParentRef.current) {
      return;
    }
    const options: ITerminalOptions = {
      cursorBlink: false,
      disableStdin: true,
      fontSize: 14,
      theme: darkTheme,
      scrollback: 9999999,
    };
    const terminal = new Terminal(options);
    terminalRef.current = terminal;
    terminal.loadAddon(fitAddon);
    terminal.open(xTermParentRef.current);
    props.logsEmitter.on('logs', logs => {
      if (terminal && logs) {
        terminal.write(logs);
      }
    });
    fitAddon.fit();
    return function cleanUp() {
      terminal.dispose();
    }
  }, []);

  useEffect(() => {
    // Fit terminal on window resize (debounced)
    let timeout: NodeJS.Timeout | undefined;
    const onWindowResize = () => {
      clearTimeout(timeout!);
      timeout = setTimeout(() => fitAddon.fit(), 20);
    };
    window.addEventListener('resize', onWindowResize);
    return function cleanUp() {
      clearTimeout(timeout!);
      window.removeEventListener('resize', onWindowResize);
    }
  }, []);

  useEffect(() => {
    if (terminalRef.current && props.errorMessage) {
      terminalRef.current.write(`\r\n\u001b[38;5;196m${props.errorMessage}\u001b[0m\r\n`);
    }
  }, [ terminalRef.current, props.errorMessage ]);

  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }
    terminalRef.current.setOption('theme', isDark ? darkTheme : lightTheme);
  }, [ terminalRef.current, isDark ]);

  return <div className={`${props.classes || 'mt-6 h-72 w-11/12 lg:w-3/5 rounded-xl overflow-hidden'} bg-gray-100 dark:bg-gray-800 relative`}>
    <div className="absolute top-0 left-0 bottom-0 right-0 m-6" ref={xTermParentRef}></div>
  </div>;
}
