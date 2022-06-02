/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { ContainerModule } from "inversify";
import { PrebuildUpdater } from "../../src/prebuild-updater";
import { PrebuildUpdaterDB } from "./prebuild-updater-db";

export const containerModuleEE = new ContainerModule((bind, unbind, isBound, rebind) => {
    rebind(PrebuildUpdater).to(PrebuildUpdaterDB).inSingletonScope();
});
