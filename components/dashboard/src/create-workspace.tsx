/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import { CreateWorkspace } from "./components/create/create-workspace";
import { start } from "./components/create/index";

start(CreateWorkspace);
