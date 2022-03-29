import yargs = require("yargs/yargs");
import { toGitpod } from "./converter";
import fs = require("fs");

yargs(process.argv.slice(2))
    .command(
        "convert",
        "converts a devcontainer file to .gitpod.yml",
        () => {},
        (argv) => {
            if (argv.toDevcontainer) {
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
