/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { MessageConnection } from 'vscode-jsonrpc';

export const ConnectionHandler = Symbol('ConnectionHandler');

export interface ConnectionHandler {
  readonly path: string;
  onConnection(connection: MessageConnection, session?: object): void;
}

export interface ConnectionEventHandler {
  /**
   * Called when the transport underpinning the connection got closed
   */
  onTransportDidClose(): void;

  /**
   * Called when the transport underpinning the connection is (re-)opened
   */
  onTransportDidOpen(): void;
}
