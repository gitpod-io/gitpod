/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { interfaces } from "inversify";
import { KeyProvider, KeyProviderImpl } from "./key-provider";
import { EncryptionEngine, EncryptionEngineImpl } from "./encryption-engine";
import { EncryptionService, EncryptionServiceImpl } from "./encryption-service";

/**
 * User have to provide a binding for KeyProviderConfig!!!
 * Example:
 *
 *  bind(KeyProviderConfig).toDynamicValue(_ctx => {
 *      return {
 *          keys: KeyProviderImpl.loadKeyConfigFromJsonString(config)
 *      };
 *  }).inSingletonScope();
 */
export const encryptionModule: interfaces.ContainerModuleCallBack = bind => {

    bind(KeyProvider).to(KeyProviderImpl).inSingletonScope();

    bind(EncryptionEngine).to(EncryptionEngineImpl).inSingletonScope();
    bind(EncryptionService).to(EncryptionServiceImpl).inSingletonScope();
};