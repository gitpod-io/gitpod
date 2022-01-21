/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceManagerClient } from './core_grpc_pb';
import {
  ControlPortRequest,
  ControlPortResponse,
  DescribeWorkspaceRequest,
  DescribeWorkspaceResponse,
  MarkActiveRequest,
  MarkActiveResponse,
  StartWorkspaceRequest,
  StartWorkspaceResponse,
  StopWorkspaceRequest,
  StopWorkspaceResponse,
  GetWorkspacesRequest,
  GetWorkspacesResponse,
  TakeSnapshotRequest,
  SetTimeoutRequest,
  SetTimeoutResponse,
  SubscribeRequest,
  SubscribeResponse,
  ControlAdmissionRequest,
  ControlAdmissionResponse,
  TakeSnapshotResponse,
} from './core_pb';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import * as opentracing from 'opentracing';
import * as grpc from '@grpc/grpc-js';
import { Disposable } from '@gitpod/gitpod-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

export function withTracing(ctx: TraceContext) {
  const metadata = new grpc.Metadata();
  if (ctx.span) {
    const carrier: { [key: string]: string } = {};
    opentracing.globalTracer().inject(ctx.span, opentracing.FORMAT_HTTP_HEADERS, carrier);
    Object.keys(carrier)
      .filter((p) => carrier.hasOwnProperty(p))
      .forEach((p) => metadata.set(p, carrier[p]));
  }
  return metadata;
}

type RetryStrategy = <Res>(run: (attempt: number) => Promise<Res>) => Promise<Res>;
export const noRetry: RetryStrategy = <Res>(run: (attempt: number) => Promise<Res>) => run(0);
export function linearBackoffStrategy(
  attempts: number,
  millisecondsBetweenAttempts: number,
  stopSignal?: { stop: boolean },
): RetryStrategy {
  return <Res>(run: (attempt: number) => Promise<Res>) =>
    linearBackoffRetry(run, attempts, millisecondsBetweenAttempts, stopSignal);
}

async function linearBackoffRetry<Res>(
  run: (attempt: number) => Promise<Res>,
  attempts: number,
  delayMS: number,
  stopSignal?: { stop: boolean },
): Promise<Res> {
  let error: Error | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      return await run(i);
    } catch (err) {
      error = err;
      if (i >= attempts) {
        break;
      }

      const isStreamRemovedErr =
        'code' in err &&
        err.code === grpc.status.UNKNOWN &&
        'details' in err &&
        err.details.startsWith('Stream removed');
      const isUnavailableErr = 'code' in err && err.code === grpc.status.UNAVAILABLE;
      const isDeadlineExceeded = 'code' in err && err.code === grpc.status.DEADLINE_EXCEEDED;
      if (!isStreamRemovedErr && !isUnavailableErr && !isDeadlineExceeded) {
        throw err;
      }

      log.warn(`ws-manager unavailable - retrying in ${delayMS}ms`, err);
      await new Promise((retry, _) => setTimeout(retry, delayMS));
    }

    if (stopSignal && stopSignal.stop) {
      throw new Error('ws-manager client stopped');
    }
  }

  log.error(`ws-manager unavailable - no more attempts left`);
  throw error;
}

export class PromisifiedWorkspaceManagerClient implements Disposable {
  constructor(
    public readonly client: WorkspaceManagerClient,
    protected readonly retryIfUnavailable: RetryStrategy = noRetry,
    protected readonly interceptor: grpc.Interceptor[],
    protected readonly stopSignal?: { stop: boolean },
  ) {}

  public startWorkspace(ctx: TraceContext, request: StartWorkspaceRequest): Promise<StartWorkspaceResponse> {
    return this.retryIfUnavailable(
      (attempt: number) =>
        new Promise<StartWorkspaceResponse>((resolve, reject) => {
          const span = TraceContext.startSpan(`/ws-manager/startWorkspace`, ctx);
          span.log({ attempt });
          this.client.startWorkspace(request, withTracing({ span }), this.getDefaultUnaryOptions(), (err, resp) => {
            span.finish();
            if (err) {
              if (attempt < 3 && err.message.indexOf('already exists') !== -1) {
                // lets wait a bit more
              } else {
                reject(err);
              }
            } else {
              resolve(resp);
            }
          });
        }),
    );
  }

  public stopWorkspace(ctx: TraceContext, request: StopWorkspaceRequest): Promise<StopWorkspaceResponse> {
    return this.retryIfUnavailable(
      (attempt: number) =>
        new Promise<StopWorkspaceResponse>((resolve, reject) => {
          const span = TraceContext.startSpan(`/ws-manager/stopWorkspace`, ctx);
          span.log({ attempt });
          this.client.stopWorkspace(request, withTracing({ span }), this.getDefaultUnaryOptions(), (err, resp) => {
            span.finish();
            if (err) {
              reject(err);
            } else {
              resolve(resp);
            }
          });
        }),
    );
  }

  public markActive(ctx: TraceContext, request: MarkActiveRequest): Promise<MarkActiveResponse> {
    return this.retryIfUnavailable(
      (attempt: number) =>
        new Promise<MarkActiveResponse>((resolve, reject) => {
          const span = TraceContext.startSpan(`/ws-manager/markActive`, ctx);
          span.log({ attempt });
          this.client.markActive(request, withTracing({ span }), this.getDefaultUnaryOptions(), (err, resp) => {
            span.finish();
            if (err) {
              reject(err);
            } else {
              resolve(resp);
            }
          });
        }),
    );
  }

  public setTimeout(ctx: TraceContext, request: SetTimeoutRequest): Promise<SetTimeoutResponse> {
    return this.retryIfUnavailable(
      (attempt: number) =>
        new Promise<MarkActiveResponse>((resolve, reject) => {
          const span = TraceContext.startSpan(`/ws-manager/setTimeout`, ctx);
          span.log({ attempt });
          this.client.setTimeout(request, withTracing({ span }), this.getDefaultUnaryOptions(), (err, resp) => {
            span.finish();
            if (err) {
              reject(err);
            } else {
              resolve(resp);
            }
          });
        }),
    );
  }

  public controlPort(ctx: TraceContext, request: ControlPortRequest): Promise<ControlPortResponse> {
    return this.retryIfUnavailable(
      (attempt: number) =>
        new Promise<ControlPortResponse>((resolve, reject) => {
          const span = TraceContext.startSpan(`/ws-manager/controlPort`, ctx);
          span.log({ attempt });
          this.client.controlPort(request, withTracing({ span }), this.getDefaultUnaryOptions(), (err, resp) => {
            span.finish();
            if (err) {
              reject(err);
            } else {
              resolve(resp);
            }
          });
        }),
    );
  }

  public describeWorkspace(ctx: TraceContext, request: DescribeWorkspaceRequest): Promise<DescribeWorkspaceResponse> {
    return this.retryIfUnavailable(
      (attempt: number) =>
        new Promise<DescribeWorkspaceResponse>((resolve, reject) => {
          const span = TraceContext.startSpan(`/ws-manager/describeWorkspace`, ctx);
          span.log({ attempt });
          this.client.describeWorkspace(request, withTracing({ span }), this.getDefaultUnaryOptions(), (err, resp) => {
            span.finish();
            if (err) {
              reject(err);
            } else {
              resolve(resp);
            }
          });
        }),
    );
  }

  public getWorkspaces(ctx: TraceContext, request: GetWorkspacesRequest): Promise<GetWorkspacesResponse> {
    return this.retryIfUnavailable(
      (attempt: number) =>
        new Promise<GetWorkspacesResponse>((resolve, reject) => {
          const span = TraceContext.startSpan(`/ws-manager/getWorkspaces`, ctx);
          span.log({ attempt });
          this.client.getWorkspaces(request, withTracing({ span }), this.getDefaultUnaryOptions(), (err, resp) => {
            span.finish();
            if (err) {
              reject(err);
            } else {
              resolve(resp);
            }
          });
        }),
    );
  }

  public takeSnapshot(ctx: TraceContext, request: TakeSnapshotRequest): Promise<TakeSnapshotResponse> {
    // we do not use the default options here as takeSnapshot can take a very long time - much longer than the default deadline allows
    return this.retryIfUnavailable(
      (attempt: number) =>
        new Promise<TakeSnapshotResponse>((resolve, reject) => {
          const span = TraceContext.startSpan(`/ws-manager/takeSnapshot`, ctx);
          span.log({ attempt });
          this.client.takeSnapshot(request, withTracing({ span }), this.getDefaultUnaryOptions(), (err, resp) => {
            span.finish();
            if (err) {
              reject(err);
            } else {
              resolve(resp);
            }
          });
        }),
    );
  }

  public controlAdmission(ctx: TraceContext, request: ControlAdmissionRequest): Promise<ControlAdmissionResponse> {
    // we do not use the default options here as takeSnapshot can take a very long time - much longer than the default deadline allows
    return this.retryIfUnavailable(
      (attempt: number) =>
        new Promise<ControlAdmissionResponse>((resolve, reject) => {
          const span = TraceContext.startSpan(`/ws-manager/controlAdmission`, ctx);
          span.log({ attempt });
          this.client.controlAdmission(request, withTracing({ span }), this.getDefaultUnaryOptions(), (err, resp) => {
            span.finish();
            if (err) {
              reject(err);
            } else {
              resolve(resp);
            }
          });
        }),
    );
  }

  public subscribe(
    ctx: TraceContext,
    request: SubscribeRequest,
  ): Promise<grpc.ClientReadableStream<SubscribeResponse>> {
    return new Promise<grpc.ClientReadableStream<SubscribeResponse>>((resolve, reject) => {
      const span = TraceContext.startSpan(`/ws-manager/subscribe`, ctx);
      try {
        resolve(this.client.subscribe(request, withTracing({ span })));
      } catch (err) {
        reject(err);
      }
    });
  }

  protected getDefaultUnaryOptions(): Partial<grpc.CallOptions> {
    let deadline = new Date(new Date().getTime() + 30000);
    return {
      deadline,
      interceptors: this.interceptor,
    };
  }

  public dispose() {
    if (this.stopSignal) {
      this.stopSignal.stop = true;
    }
  }
}
