/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require('reflect-metadata');

import { ContainerModule } from 'inversify';
import { MessageBusHelper, MessageBusHelperImpl } from '@gitpod/gitpod-messagebus/lib';
import { MessagebusConfiguration } from '@gitpod/gitpod-messagebus/lib/config';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { MessageBusIntegration } from './messagebus-integration';
import { Configuration } from './config';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceManagerBridgeFactory, WorkspaceManagerBridge } from './bridge';
import { TracingManager } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { PrometheusMetricsExporter } from './prometheus-metrics-exporter';

export const containerModule = new ContainerModule(bind => {

    bind(MessagebusConfiguration).toSelf().inSingletonScope();
    bind(MessageBusHelper).to(MessageBusHelperImpl).inSingletonScope();
    bind(MessageBusIntegration).toSelf().inSingletonScope();

    bind(WorkspaceManagerBridge).toSelf().inRequestScope();
    bind(WorkspaceManagerBridgeFactory).toAutoFactory(WorkspaceManagerBridge);

    bind(TracingManager).toSelf().inSingletonScope();

    bind(PrometheusMetricsExporter).toSelf().inSingletonScope();

    bind(Configuration).toDynamicValue(ctx => {
        let result: Configuration = {
            controllerIntervalSeconds: 60,
            controllerMaxDisconnectSeconds: 150,
            maxTimeToRunningPhaseSeconds: 1 * 60 * 60,
            staticBridges: []
        };

        let cfgPath = process.env.WSMAN_BRIDGE_CONFIGPATH;
        if (cfgPath) {
            const telepresence = process.env.TELEPRESENCE_ROOT;
            if (!!telepresence) {
                cfgPath = path.join(telepresence, cfgPath);
            }

            const cfg = fs.readFileSync(cfgPath);
            result = JSON.parse(cfg.toString());
        } else {
            log.warn("No WSMAN_BRIDGE_CONFIGPATH env var set - running without any static bridge. Is that what you want?")
        }

        return result;
    }).inSingletonScope();
});
