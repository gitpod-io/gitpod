/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require('reflect-metadata');

import { Container } from 'inversify';
import { containerModule } from './container-module';
import { start } from './main';

import { dbContainerModule } from '@gitpod/gitpod-db/lib/container-module';

const container = new Container();
container.load(containerModule);
container.load(dbContainerModule);

start(container);
