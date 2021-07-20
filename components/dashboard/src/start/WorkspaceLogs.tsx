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
import { DisposableCollection, GitpodServer, HEADLESS_LOG_STREAM_STATUS_CODE_REGEX } from '@gitpod/gitpod-protocol';

export interface WorkspaceLogsProps {
  logsEmitter: EventEmitter;
  errorMessage?: string;
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
    const theme: ITheme = {};
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

  componentDidUpdate() {
    if (this.terminal && this.props.errorMessage) {
      this.terminal.write(`\n\u001b[38;5;196m${this.props.errorMessage}\u001b[0m`);
    }
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

export function watchHeadlessLogs(server: GitpodServer, instanceId: string, onLog: (chunk: string) => void, checkIsDone: () => Promise<boolean>): DisposableCollection {
  const disposables = new DisposableCollection();

  const startWatchingLogs = async () => {
    if (await checkIsDone()) {
      return;
    }

    const retry = async (reason: string, err?: Error) => {
      console.debug("re-trying headless-logs because: " + reason, err);
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
      startWatchingLogs().catch(console.error);
    };

    let response: Response | undefined = undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined = undefined;
    try {
      const logSources = await server.getHeadlessLog(instanceId);
      // TODO(gpl) Only listening on first stream for now
      const streamIds = Object.keys(logSources.streams);
      if (streamIds.length < 1) {
        await retry("no streams");
        return;
      }

      const streamUrl = logSources.streams[streamIds[0]];
      console.log("fetching from streamUrl: " + streamUrl);
      response = await fetch(streamUrl, {
        method: 'GET',
        cache: 'no-cache',
        credentials: 'include',
        keepalive: true,
        headers: {
          'TE': 'trailers', // necessary to receive stream status code
        },
      });
      reader = response.body?.getReader();
      if (!reader) {
        await retry("no reader");
        return;
      }
      disposables.push({ dispose: () => reader?.cancel() });

      const decoder = new TextDecoder('utf-8');
      let chunk = await reader.read();
      while (!chunk.done) {
        const msg = decoder.decode(chunk.value, { stream: true });

        // In an ideal world, we'd use res.addTrailers()/response.trailer here. But despite being introduced with HTTP/1.1 in 1999, trailers are not supported by popular proxies (nginx, for example).
        // So we resort to this hand-written solution:
        const matches = msg.match(HEADLESS_LOG_STREAM_STATUS_CODE_REGEX);
        if (matches) {
          if (matches.length < 2) {
            console.debug("error parsing log stream status code. msg: " + msg);
          } else {
            const streamStatusCode = matches[1];
            if (streamStatusCode !== "200") {
              throw new Error("received status code: " + streamStatusCode);
            }
          }
        } else {
          onLog(msg);
        }

        chunk = await reader.read();
      }
      reader.cancel()

      if (await checkIsDone()) {
        return;
      }
    } catch(err) {
      reader?.cancel().catch(console.debug);
      await retry("error while listening to stream", err);
    }
  };
  startWatchingLogs().catch(console.error);

  return disposables;
}