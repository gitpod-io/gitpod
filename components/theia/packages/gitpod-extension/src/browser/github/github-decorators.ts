/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { tagged } from "inversify";
import { GITHOSTER } from "../githoster/githoster-frontend-module";
import { GITHUB_ID } from "./github-extension";

export const github = tagged(GITHOSTER, GITHUB_ID);
