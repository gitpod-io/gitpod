/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";
import { PrebuildUpdater } from "../../src/prebuild-updater";
import { PrebuildUpdaterDB } from "./prebuild-updater-db";

export const containerModuleEE = new ContainerModule((bind, unbind, isBound, rebind) => {
    rebind(PrebuildUpdater).to(PrebuildUpdaterDB).inSingletonScope();
});
