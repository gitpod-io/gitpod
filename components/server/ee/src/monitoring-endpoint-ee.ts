/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as express from 'express';
import { WorkspaceHealthMonitoring } from './workspace/workspace-health-monitoring';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { injectable, inject } from 'inversify';
import { register } from '../../src/prometheus-metrics';

@injectable()
export class MonitoringEndpointsAppEE extends WorkspaceHealthMonitoring {
  @inject(WorkspaceHealthMonitoring) protected readonly workspaceHealthMonitoring: WorkspaceHealthMonitoring;

  public create(): express.Application {
    const monApp = express();
    monApp.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (ex) {
        res.status(500).end(ex);
      }
    });

    monApp.get('/workspace-health', async (req, res) => {
      try {
        const result = await checkWorkspaceHealth({}, this.workspaceHealthMonitoring, !!req.query.extra);
        if (result.unhealthy > 0) {
          console.warn('not all workspaces are healthy', result);
          res.status(406).send(result);
        } else {
          res.status(200).send(result);
        }
      } catch (err) {
        log.debug('failed to check workspace health', err);
        res.status(500).send(err);
      }
    });

    return monApp;
  }
}

async function checkWorkspaceHealth(
  ctx: TraceContext,
  workspaceHealthMonitoring: WorkspaceHealthMonitoring,
  extra: boolean = false,
) {
  const span = TraceContext.startSpan('checkWorkspaceHealth', ctx);
  const result = await workspaceHealthMonitoring.probeAllRunningWorkspaces({ span });
  const numUnhealthy = result.map((r) => (r.ok ? 0 : 1)).reduce((acc: number, cur: number) => (acc + cur) as number, 0);
  let returnValue = {
    status: numUnhealthy > 0 ? (numUnhealthy == result.length ? 'unhealthy' : 'partially healthy') : 'fully healthy',
    healthy: result.length - numUnhealthy,
    unhealthy: numUnhealthy,
    total: result.length,
    timestamp: Date.now(),
  };
  if (extra && numUnhealthy > 0) {
    return {
      ...returnValue,
      extra: {
        unhealthyWorkspaces: result.filter((r) => !r.ok),
        notRunningWorkspaces: result.filter((r) => r.status !== 'running'),
      },
    };
  }
  span.finish();
  return returnValue;
}
