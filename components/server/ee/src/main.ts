/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { start } from "../../src/init";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Container } from "inversify";
import { productionContainerModule } from "../../src/container-module";
import { productionEEContainerModule } from "./container-module";
import { dbContainerModule } from "@gitpod/gitpod-db/lib/container-module";

const container = new Container();
container.load(productionContainerModule);
container.load(productionEEContainerModule);
container.load(dbContainerModule);

start(container).catch((err) => {
    log.error("Error during startup or operation. Exiting.", err);
    process.exit(1);
});
