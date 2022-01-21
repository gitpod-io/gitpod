/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
  WorkspaceStatus,
  SubscribeRequest,
  SubscribeResponse,
  GetWorkspacesRequest,
  PromisifiedWorkspaceManagerClient,
} from '@gitpod/ws-manager/lib';
import { Disposable } from '@gitpod/gitpod-protocol';
import { ClientReadableStream } from '@grpc/grpc-js';
import { log, LogPayload } from '@gitpod/gitpod-protocol/lib/util/logging';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import * as opentracing from 'opentracing';

export type ClientProvider = () => Promise<PromisifiedWorkspaceManagerClient>;

export class WsmanSubscriber implements Disposable {
  protected run = true;
  protected sub: ClientReadableStream<SubscribeResponse> | undefined;

  constructor(protected readonly clientProvider: ClientProvider) {}

  public async subscribe(
    callbacks: {
      onStatusUpdate: (ctx: TraceContext, s: WorkspaceStatus) => void;
      onReconnect: (ctx: TraceContext, s: WorkspaceStatus[]) => void;
    },
    logPayload?: LogPayload,
  ) {
    const payload = logPayload || ({} as LogPayload);
    while (this.run) {
      await new Promise<void>(async (resolve, reject) => {
        log.info('attempting to establish wsman subscription', payload);
        let client: PromisifiedWorkspaceManagerClient | undefined = undefined;
        try {
          client = await this.clientProvider();

          // take stock of the existing workspaces
          const workspaces = await client.getWorkspaces({}, new GetWorkspacesRequest());
          callbacks.onReconnect({}, workspaces.getStatusList());

          // start subscription
          const req = new SubscribeRequest();
          this.sub = await client.subscribe({}, req);

          this.sub.on('data', (incoming: SubscribeResponse) => {
            const status = incoming.getStatus();
            if (!!status) {
              let header: any = {};
              if (!!incoming.getHeaderMap()) {
                incoming.getHeaderMap().forEach((v: string, k: string) => (header[k] = v));
              }
              const spanCtx = opentracing.globalTracer().extract(opentracing.FORMAT_HTTP_HEADERS, header);
              const span = !!spanCtx
                ? opentracing
                    .globalTracer()
                    .startSpan('incomingSubscriptionResponse', { references: [opentracing.childOf(spanCtx!)] })
                : undefined;

              callbacks.onStatusUpdate({ span }, status);
            }
          });
          this.sub.on('end', function () {
            resolve();
          });
          this.sub.on('error', function (e) {
            log.error('wsman subscription error', e, payload);
            resolve();
          });
        } catch (err) {
          log.error('cannot maintain subscription to wsman', err, payload);
          resolve();
        } finally {
          if (client) {
            client.dispose();
          }
        }
      });

      if (!this.run) {
        log.info('shutting down wsman subscriber', payload);
        return;
      } else {
        // we have been disconnected forcefully - wait for some time and try again
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  public dispose() {
    this.run = false;
    if (!!this.sub) {
      this.sub.cancel();
    }
  }
}
