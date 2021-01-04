/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Container } from 'inversify';
import { dbContainerModule } from './container-module';

export const testContainer = new Container();
testContainer.load(dbContainerModule);
