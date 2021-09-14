/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

require("reflect-metadata")

import { ArgumentParser } from "argparse";
import { log, LogrusLogLevel } from '@gitpod/gitpod-protocol/lib/util/logging';
import { ICommand } from "./commands";
import { Container } from "inversify";
import { productionContainerModule } from "./container-module";
log.enableJSONLogging('db-sync', undefined, LogrusLogLevel.getFromEnv());

const parser = new ArgumentParser({
    version: "0.1.5",
    addHelp: true,
    description: "Process for synchronising a cache database with a central master"
});
const subparser = parser.addSubparsers({
    title: 'commands',
    dest: 'cmd'
});
parser.addArgument("--start-date", {
    help: "The date from which to consider data"
});
parser.addArgument("--end-date", {
    help: "The date until which to consider data"
});
parser.addArgument("--verbose", {
    help: "Print verbose output (debug and progress bar)",
    nargs: 0
});

const container = new Container();
container.load(productionContainerModule);

let commands = container.getAll(ICommand) as ICommand[];
commands.forEach(c => {
    const cmdparser = subparser.addParser(c.name, {
        addHelp: true ,
        help: c.help
    });
    c.addOptions(cmdparser);
});

const rawArgs = parser.parseKnownArgs();
const args = rawArgs[0];
const cmd = commands.find(c => c.name == args.cmd);
if(cmd) {
    args.start_date = args.start_date ? Date.parse(args.start_date) : undefined;
    args.end_date = args.end_date ? Date.parse(args.end_date) : undefined;

    (async () => {
        await cmd.run(args);
        console.log("Done");
    })().catch(e => {
        console.error(e);
        process.exit(1);
    }).then(() => {
        process.exit(0);
    });
} else {
    console.error("Unknown command: ", args.cmd);
}


