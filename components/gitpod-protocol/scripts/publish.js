/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @ts-check

const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
const qualifier = process.argv[2];

const rootDir = process.cwd();
const pckDir = path.join(rootDir, process.argv[3]);

if (process.env.DO_PUBLISH === "false") {
    console.warn("Skipping publishing per request.");
    process.exit(0);
}

// Check if we should use OIDC (GitHub Actions with id-token permission)
const useOIDC = process.env.ACTIONS_ID_TOKEN_REQUEST_URL && process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

if (useOIDC) {
    console.log("Using npm OIDC authentication (provenance)");
} else if (process.env.NPM_AUTH_TOKEN) {
    fs.writeFileSync(
        path.join(pckDir, ".npmrc"),
        `//registry.npmjs.org/:_authToken=${process.env.NPM_AUTH_TOKEN}\n`,
        "utf-8",
    );
} else {
    console.warn("NPM_AUTH_TOKEN env variable is not set and OIDC is not available");
}

const pck = JSON.parse(fs.readFileSync(path.join(pckDir, "package.json"), "utf-8"));
pck.version = `${pck.version}-${qualifier}`;
fs.writeFileSync(path.join(pckDir, "package.json"), JSON.stringify(pck, undefined, 2), "utf-8");

const tag = qualifier.substr(0, qualifier.lastIndexOf("."));

if (useOIDC) {
    // Use npm with provenance for OIDC
    child_process.execSync(
        [
            "npm",
            "publish",
            "--tag",
            tag,
            "--access",
            "public",
            "--provenance",
            "--ignore-scripts",
        ].join(" "),
        { stdio: "inherit", cwd: pckDir },
    );
} else {
    // Fall back to yarn for token-based auth
    child_process.execSync(
        [
            "yarn",
            "--cwd",
            pckDir,
            "publish",
            "--tag",
            tag,
            "--access",
            "public",
            "--ignore-scripts",
            "--network-timeout",
            "300000",
        ].join(" "),
        { stdio: "inherit" },
    );
}
