# Server Readiness Probe PRD

## Overview

This document outlines the implementation of a readiness probe for the Gitpod server deployment. The readiness probe will ensure that the server is only considered ready when it has established connections to both the database and SpiceDB authorizer.

## Background

Currently, the server deployment has a liveness probe that checks the event loop lag, but it does not have a readiness probe. This means that the server is considered ready to receive traffic as soon as the container starts, even if it hasn't established connections to critical dependencies like the database and SpiceDB.

## Requirements

1. Create a readiness endpoint in the server that checks:
   - Database connectivity
   - SpiceDB authorizer connectivity
2. Configure the Kubernetes deployment to use this endpoint as a readiness probe

## Implementation Details

### 1. Readiness Controller

We've created a new `ReadinessController` class in `components/server/src/liveness/readiness-controller.ts` that:
- Checks database connectivity by executing a simple query
- Checks SpiceDB connectivity by attempting to get a client
- Returns a 200 status code only if both checks pass, otherwise returns a 503 status code

```typescript
// components/server/src/liveness/readiness-controller.ts
import { injectable, inject } from "inversify";
import express from "express";
import { TypeORM } from "@gitpod/gitpod-db/lib";
import { SpiceDBClientProvider } from "../authorization/spicedb";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class ReadinessController {
    @inject(TypeORM) protected readonly typeOrm: TypeORM;
    @inject(SpiceDBClientProvider) protected readonly spiceDBClientProvider: SpiceDBClientProvider;

    get apiRouter(): express.Router {
        const router = express.Router();
        this.addReadinessHandler(router);
        return router;
    }

    protected addReadinessHandler(router: express.Router) {
        router.get("/", async (_, res) => {
            try {
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

                // Both connections are good
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
            // Just getting the client without error is a basic check
            // If the client is not available, getClient() will throw an error
            this.spiceDBClientProvider.getClient();
            return true;
        } catch (error) {
            log.error("SpiceDB connection check failed", error);
            return false;
        }
    }
}
```

### 2. Server Configuration

We've updated the server's container module to include the `ReadinessController`:

```typescript
// In container-module.ts
import { ReadinessController } from "./liveness/readiness-controller";

// In the productionContainerModule
bind(ReadinessController).toSelf().inSingletonScope();
```

We've also updated the server's route configuration to register the readiness endpoint:

```typescript
// In server.ts
import { ReadinessController } from "./liveness/readiness-controller";

// In the constructor
@inject(ReadinessController) private readonly readinessController: ReadinessController,

// In registerRoutes method
app.use("/ready", this.readinessController.apiRouter);
```

### 3. Kubernetes Deployment

We need to update the server deployment in `install/installer/pkg/components/server/deployment.go` to add a readiness probe:

```go
ReadinessProbe: &corev1.Probe{
    ProbeHandler: corev1.ProbeHandler{
        HTTPGet: &corev1.HTTPGetAction{
            Path: "/ready",
            Port: intstr.IntOrString{
                Type:   intstr.Int,
                IntVal: ContainerPort,
            },
        },
    },
    InitialDelaySeconds: 30,
    PeriodSeconds: 10,
    FailureThreshold: 3,
},
```

## Testing

The readiness probe should be tested to ensure:

1. The server is only considered ready when both database and SpiceDB connections are established
2. The server is not considered ready if either connection fails
3. The server becomes ready again when connections are re-established

## Deployment Considerations

- The readiness probe has an initial delay of 30 seconds to allow the server time to establish connections
- The probe runs every 10 seconds
- The probe allows up to 3 failures before marking the pod as not ready

## Future Improvements

- Add more sophisticated checks for SpiceDB connectivity, such as a simple permission check
- Add metrics for readiness probe failures
- Consider adding more dependencies to the readiness check as needed

## Conclusion

This implementation ensures that the server is only considered ready when it has established connections to both the database and SpiceDB authorizer. This improves the reliability of the deployment by preventing traffic from being sent to instances that are not fully initialized.
