/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * We include this here to:
 *  - inject headers into the transport layer (HTTP requests) for auth
 *  - build with Node.js 'ws' library
 */

import { Metadata } from '@improbable-eng/grpc-web/dist/typings/metadata';
import {
  Transport,
  TransportFactory,
  TransportOptions,
} from '@improbable-eng/grpc-web/dist/typings/transports/Transport';
import * as WebSocket from 'ws';

enum WebsocketSignal {
  FINISH_SEND = 1,
}

const finishSendFrame = new Uint8Array([1]);

export function WebsocketTransport(): TransportFactory {
  return (opts: TransportOptions) => {
    return websocketRequest(opts);
  };
}

function websocketRequest(options: TransportOptions): Transport {
  options.debug && debug('websocketRequest', options);

  let webSocketAddress = constructWebSocketAddress(options.url);

  const sendQueue: Array<Uint8Array | WebsocketSignal> = [];
  let ws: WebSocket;

  function sendToWebsocket(toSend: Uint8Array | WebsocketSignal) {
    if (toSend === WebsocketSignal.FINISH_SEND) {
      ws.send(finishSendFrame);
    } else {
      const byteArray = toSend as Uint8Array;
      const c = new Int8Array(byteArray.byteLength + 1);
      c.set(new Uint8Array([0]));

      c.set(byteArray as any as ArrayLike<number>, 1);

      ws.send(c);
    }
  }

  return {
    sendMessage: (msgBytes: Uint8Array) => {
      if (!ws || ws.readyState === ws.CONNECTING) {
        sendQueue.push(msgBytes);
      } else {
        sendToWebsocket(msgBytes);
      }
    },
    finishSend: () => {
      if (!ws || ws.readyState === ws.CONNECTING) {
        sendQueue.push(WebsocketSignal.FINISH_SEND);
      } else {
        sendToWebsocket(WebsocketSignal.FINISH_SEND);
      }
    },
    start: (metadata: Metadata) => {
      // Send headers both with request and the HTTP request itself
      const headers: { [key: string]: string } = {};
      metadata.forEach((key, values) => (headers[key] = values.join(',')));

      ws = new WebSocket(webSocketAddress, ['grpc-websockets'], {
        headers,
      });
      ws.binaryType = 'arraybuffer';
      ws.onopen = function () {
        options.debug && debug('websocketRequest.onopen');
        ws.send(headersToBytes(metadata));

        // send any messages that were passed to sendMessage before the connection was ready
        sendQueue.forEach((toSend) => {
          sendToWebsocket(toSend);
        });
      };

      ws.onclose = function (closeEvent) {
        options.debug && debug('websocketRequest.onclose', closeEvent);
        options.onEnd();
      };

      ws.onerror = function (error) {
        options.debug && debug('websocketRequest.onerror', error);
      };

      ws.onmessage = function (e) {
        // @ts-ignore This is copied from an external library; we won't fix this here
        options.onChunk(new Uint8Array(Buffer.from(e.data)));
      };
    },
    cancel: () => {
      options.debug && debug('websocket.abort');
      ws.close();
    },
  };
}

function constructWebSocketAddress(url: string) {
  if (url.substr(0, 8) === 'https://') {
    return `wss://${url.substr(8)}`;
  } else if (url.substr(0, 7) === 'http://') {
    return `ws://${url.substr(7)}`;
  }
  throw new Error('Websocket transport constructed with non-https:// or http:// host.');
}

function headersToBytes(headers: Metadata): Uint8Array {
  let asString = '';
  headers.forEach((key, values) => {
    asString += `${key}: ${values.join(', ')}\r\n`;
  });
  return encodeASCII(asString);
}

export function debug(...args: any[]) {
  if (console.debug) {
    console.debug.apply(null, args);
  } else {
    console.log.apply(null, args);
  }
}

const isAllowedControlChars = (char: number) => char === 0x9 || char === 0xa || char === 0xd;

function isValidHeaderAscii(val: number): boolean {
  return isAllowedControlChars(val) || (val >= 0x20 && val <= 0x7e);
}

export function encodeASCII(input: string): Uint8Array {
  const encoded = new Uint8Array(input.length);
  for (let i = 0; i !== input.length; ++i) {
    const charCode = input.charCodeAt(i);
    if (!isValidHeaderAscii(charCode)) {
      throw new Error('Metadata contains invalid ASCII');
    }
    encoded[i] = charCode;
  }
  return encoded;
}
