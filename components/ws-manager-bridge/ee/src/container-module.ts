/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { ContainerModule } from 'inversify';
import { WorkspaceManagerBridgeEE } from './bridge';
import { WorkspaceManagerBridge } from '../../src/bridge';

export const containerModuleEE = new ContainerModule((bind, unbind, isBound, rebind) => {
    rebind(WorkspaceManagerBridge).to(WorkspaceManagerBridgeEE).inRequestScope();
});
