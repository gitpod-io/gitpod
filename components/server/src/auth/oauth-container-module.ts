/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ContainerModule } from 'inversify';
import { AuthProvider } from '../auth/auth-provider';
import { GenericAuthProvider } from './generic-auth-provider';

export const genericAuthContainerModule = new ContainerModule((bind, _unbind, _isBound, _rebind) => {
  bind(GenericAuthProvider).toSelf().inSingletonScope();
  bind(AuthProvider).toService(GenericAuthProvider);
});
