/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import { renderEntrypoint } from "./entrypoint";
import { InstallGithubApp } from "./components/github/install-github-app";

renderEntrypoint(InstallGithubApp);