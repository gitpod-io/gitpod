// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import { $ } from "bun";
import { updateCodeIDEConfigMapJson } from "./lib/code-pin-version"
import { appendGitHubOutput } from "./lib/common";

$.nothrow();

const newVersion = await updateCodeIDEConfigMapJson();

if (newVersion) {
    console.log("new version released", newVersion);
    await appendGitHubOutput(`codeVersion=${newVersion}`)
}
