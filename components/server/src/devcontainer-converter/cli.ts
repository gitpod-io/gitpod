/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import yargs = require("yargs/yargs");
import { toDevContainer, toGitpod } from "./converter";
import fs = require("fs");
import { parse } from "yaml";
import { GitpodConfig } from "./types-gitpod";

yargs(process.argv.slice(2))
    .command(
        "convert",
        "converts a devcontainer file to .gitpod.yml",
        () => {},
        (argv) => {
            if (argv.toDevcontainer) {
                const inputPath = (argv.file as string | null) ?? "./.gitpod.yml";
                const doc: GitpodConfig = parse(fs.readFileSync(inputPath, "utf8"));
                const result = toDevContainer(doc);
                if (argv.dry) {
                    console.log(JSON.stringify(result));
                } else {
                    const outputPath = (argv.output as string | null) ?? "./.devcontainer/devcontainer.json";
                    fs.writeFileSync(outputPath, JSON.stringify(result));
                }
            } else {
                const inputPath = (argv.file as string | null) ?? "./.devcontainer/devcontainer.json";
                const result = toGitpod(JSON.parse(fs.readFileSync(inputPath, "utf-8")), true);
                if (argv.dry) {
                    console.log(result);
                } else {
                    const outputPath = (argv.output as string | null) ?? "./.gitpod.yml";
                    fs.writeFileSync(outputPath, result);
                }
            }
        },
    )
    .option("to-devcontainer", {
        alias: "r",
        type: "boolean",
        description: "Reverse the conversion; convert from .gitpod.yml to a devcontainer.json",
    })
    .option("dry", {
        alias: "d",
        type: "boolean",
        description: "Don't rewrite any files; print the result to stdout",
    })
    .option("file", {
        alias: "f",
        type: "string",
        description: "Location of the input file",
    })
    .option("output", {
        alias: "o",
        type: "string",
        description: "Location of the output file",
    })
    .parseSync();
