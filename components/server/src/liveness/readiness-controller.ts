/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import express from "express";
import { TypeORM } from "@gitpod/gitpod-db/lib";
import { SpiceDBClientProvider } from "../authorization/spicedb";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { ReadSchemaRequest } from "@authzed/authzed-node/dist/src/v1";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { Redis } from "ioredis";

@injectable()
export class ReadinessController {
    @inject(TypeORM) protected readonly typeOrm: TypeORM;
    @inject(SpiceDBClientProvider) protected readonly spiceDBClientProvider: SpiceDBClientProvider;
    @inject(Redis) protected readonly redis: Redis;

    get apiRouter(): express.Router {
        const router = express.Router();
        this.addReadinessHandler(router);
        return router;
    }

    protected addReadinessHandler(router: express.Router) {
        router.get("/", async (_, res) => {
            try {
                // Check feature flag first
                const readinessProbeEnabled = await getExperimentsClientForBackend().getValueAsync(
                    "server_readiness_probe",
                    true, // Default to readiness probe, skip if false
                    {},
                );

                if (!readinessProbeEnabled) {
                    log.debug("Readiness check skipped due to feature flag");
                    res.status(200);
                    return;
                }

                // Check database connection
                const dbConnection = await this.checkDatabaseConnection();
                if (!dbConnection) {
                    log.warn("Readiness check failed: Database connection failed");
                    res.status(503).send("Database connection failed");
                    return;
                }

                // Check SpiceDB connection
                const spiceDBConnection = await this.checkSpiceDBConnection();
                if (!spiceDBConnection) {
                    log.warn("Readiness check failed: SpiceDB connection failed");
                    res.status(503).send("SpiceDB connection failed");
                    return;
                }

                // Check Redis connection
                const redisConnection = await this.checkRedisConnection();
                if (!redisConnection) {
                    log.warn("Readiness check failed: Redis connection failed");
                    res.status(503).send("Redis connection failed");
                    return;
                }

                // All connections are good
                res.status(200).send("Ready");
            } catch (error) {
                log.error("Readiness check failed", error);
                res.status(503).send("Readiness check failed");
            }
        });
    }

    private async checkDatabaseConnection(): Promise<boolean> {
        try {
            const connection = await this.typeOrm.getConnection();
            // Simple query to verify connection is working
            await connection.query("SELECT 1");
            return true;
        } catch (error) {
            log.error("Database connection check failed", error);
            return false;
        }
    }

    private async checkSpiceDBConnection(): Promise<boolean> {
        try {
            const client = this.spiceDBClientProvider.getClient();

            // Send a request, to verify that the connection works
            const req = ReadSchemaRequest.create({});
            const response = await client.readSchema(req);
            log.debug("SpiceDB connection check successful", { schemaLength: response.schemaText.length });

            return true;
        } catch (error) {
            log.error("SpiceDB connection check failed", error);
            return false;
        }
    }

    private async checkRedisConnection(): Promise<boolean> {
        try {
            // Simple PING command to verify connection is working
            const result = await this.redis.ping();
            log.debug("Redis connection check successful", { result });
            return result === "PONG";
        } catch (error) {
            log.error("Redis connection check failed", error);
            return false;
        }
    }
}
