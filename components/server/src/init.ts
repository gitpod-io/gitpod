/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

//#region cpu profile
/**
 * Make cpu profile by sending the server process a SIGINFO signal:
 * kill -s SIGUSR1 <pid>
 *
 * ***IMPORTANT***: making the cpu profile costs cpu and ram!
 *
 * cpu profiles are written to tmp folder and have `.cpuprofile` extension.
 * Check server logs for the concrete filename.
 */

import { Session } from "inspector";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

process.on("SIGUSR1", () => {
    const session = new Session();
    session.connect();

    session.post("Profiler.enable", () => {
        session.post("Profiler.start", async () => {
            await new Promise((resolve) => setTimeout(resolve, 5 * 60_000));

            session.post("Profiler.stop", (err, { profile }) => {
                // Write profile to disk, upload, etc.
                if (!err) {
                    const filename = path.join(os.tmpdir(), Date.now() + ".cpuprofile");
                    console.log("preparing cpuprofile: " + filename);
                    fs.promises
                        .writeFile(filename, JSON.stringify(profile))
                        .catch((err) => console.error("error writing cpuprofile", err));
                } else {
                    console.error("failed to cpuprofile: ", err);
                }
            });
        });
    });
});
//#endregion

require("reflect-metadata");
// Use asyncIterators with es2015
if (typeof (Symbol as any).asyncIterator === "undefined") {
    (Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol("asyncIterator");
}

import * as express from "express";
import { Container } from "inversify";
import { Server } from "./server";
import { log, LogrusLogLevel } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TracingManager } from "@gitpod/gitpod-protocol/lib/util/tracing";
if (process.env.NODE_ENV === "development") {
    require("longjohn");
}

log.enableJSONLogging("server", process.env.VERSION, LogrusLogLevel.getFromEnv());

export async function start(container: Container) {
    const server = container.get(Server);
    const port = 3000;
    const app = express();

    process.on("uncaughtException", function (err) {
        // fix for https://github.com/grpc/grpc-node/blob/master/packages/grpc-js/src/load-balancer-pick-first.ts#L309
        if (err && err.message && err.message.includes("reading 'startConnecting'")) {
            log.error("uncaughtException", err);
        } else {
            throw err;
        }
    });

    process.on("SIGTERM", async () => {
        log.info("SIGTERM received, stopping");
        await server.stop();
    });

    const tracing = container.get(TracingManager);
    tracing.setup(process.env.JAEGER_SERVICE_NAME ?? "server", {
        perOpSampling: {
            createWorkspace: true,
            startWorksace: true,
            sendHeartbeat: false,
        },
    });

    await server.init(app);
    await server.start(port);
}
