/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { Job } from "../jobs/runner";
import { Config } from "../config";
import { Redis } from "ioredis";
import { UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { LogContext, log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Disposable, Queue, WorkspaceInstance, WorkspaceInstancePhase } from "@gitpod/gitpod-protocol";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import { durationLongerThanSeconds } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { DescribeWorkspaceRequest, PromisifiedWorkspaceManagerClient } from "@gitpod/ws-manager/lib";
import { WorkspaceStarter } from "./workspace-starter";
import { EnvVarService } from "../user/env-var-service";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { TrustedValue } from "@gitpod/gitpod-protocol/lib/util/scrubbing";

const REDIS_CONTROLLER_ID_PREFIX = "workspace-start-controller-id";
const redisControllerIdKey = (id: string) => `${REDIS_CONTROLLER_ID_PREFIX}:${id}`;
const stripRedisControllerIdPrefix = (key: string): string | undefined => {
    if (!key.startsWith(REDIS_CONTROLLER_ID_PREFIX + ":")) {
        return undefined;
    }
    return key.substring(REDIS_CONTROLLER_ID_PREFIX.length + 1);
};

/**
 * DistributedWorkspaceStartController ensures there is always exactly one WorkspaceStartController repsonsible for a given workspace instance.
 * It does so by:
 *  - implement a heartbeat mechanism with redis
 *  - check regularly (+ on start) for uncontrolled instances by:
 *    - assuming a Redlock (only one of the server instances wins)
 *    - check for orphaned instances:
 *     - if there are any, have the local WorkspaceStartController take control
 */
@injectable()
export class DistributedWorkspaceStartController implements Job {
    public readonly name = "workspace-start-controller";
    // How often we check for uncontrolled instances (+ once on startup)
    public readonly frequencyMs = 60 * 1000;

    private readonly heartbeatIntervalMs = 10 * 1000;
    // After this period without update we consider a controller dead
    private get redisExpiryTime() {
        return (this.heartbeatIntervalMs / 1000) * 1.5;
    }

    constructor(
        @inject(Redis) private readonly redis: Redis,
        @inject(WorkspaceStartController) private readonly localController: WorkspaceStartController,
    ) {}

    public start(): Disposable {
        return repeat(() => this.heartbeat(), this.heartbeatIntervalMs);
    }

    private async heartbeat() {
        // Mark ourselves as active
        const controllerId = this.localController.getControllerId();
        await this.redis.setex(redisControllerIdKey(controllerId), this.redisExpiryTime, controllerId);
    }

    /**
     * This is the loop checking regularly (and on start) for uncontrolled instances, and claiming ownership of those.
     */
    public async run(): Promise<void> {
        const activeControllerIds = await this.listAllActiveControllerIds();
        log.info("[wsc] all active controller ids", { activeControllerIds: new TrustedValue(activeControllerIds) });

        await this.localController.checkForOrphanedInstances(activeControllerIds);
    }

    private async listAllActiveControllerIds(): Promise<WorkspaceStartControllerId[]> {
        const keys = await new Promise<string[]>((resolve, reject) => {
            const result: string[] = [];
            this.redis
                .scanStream({ match: redisControllerIdKey("*"), count: 20 })
                .on("data", async (keys: string[]) => {
                    result.push(...keys);
                })
                .on("error", reject)
                .on("end", () => {
                    resolve(result);
                });
        });

        const allActiveIds = new Map<string, WorkspaceStartControllerId>();
        const localControllerId = this.localController.id;
        allActiveIds.set(WorkspaceStartControllerId.toString(localControllerId), localControllerId); // we're are definitely active
        for (const idStr of keys.map(stripRedisControllerIdPrefix)) {
            if (!idStr) {
                continue;
            }
            const id = WorkspaceStartControllerId.fromString(idStr);
            if (!id) {
                log.warn("[wsc] cannot parse controller id", { idStr });
                continue;
            }
            allActiveIds.set(idStr, id);
        }
        return Array.from(allActiveIds.values());
    }
}

const MANAGED_PHASES: WorkspaceInstancePhase[] = ["preparing", "building", "pending"];

@injectable()
export class WorkspaceStartController {
    public readonly id: WorkspaceStartControllerId;

    // Used for sequencing doControlStartingWorkspace()
    private readonly queue = new Queue();

    // How often we check "our" instances
    private readonly controllerFrequencyMs = 10 * 1000;

    constructor(
        @inject(Config) private readonly config: Config,
        @inject(WorkspaceDB) private readonly workspaceDb: WorkspaceDB,
        @inject(EnvVarService) private readonly envVarService: EnvVarService,
        @inject(UserDB) private readonly userDb: UserDB,
        @inject(WorkspaceStartRegistry) private readonly startingInstances: WorkspaceStartRegistry,
        @inject(WorkspaceManagerClientProvider) private readonly clientProvider: WorkspaceManagerClientProvider,
        @inject(WorkspaceStarter) private readonly workspaceStarter: WorkspaceStarter,
    ) {
        this.id = WorkspaceStartControllerId.create(this.config.version);
    }

    public start(): Disposable {
        return repeat(() => this.controlAllOurStartingWorkspaces(), this.controllerFrequencyMs);
    }

    private async controlAllOurStartingWorkspaces() {
        const instances = await this.workspaceDb.findInstancesByPhase(MANAGED_PHASES);
        for (const instance of instances) {
            await this.doControlStartingWorkspace(instance);
        }
    }

    public async checkForOrphanedInstances(_activeControllerIds: WorkspaceStartControllerId[]) {
        const localControllerId = this.getControllerId();

        const activeControllerIds = _activeControllerIds.map((id) => WorkspaceStartControllerId.toString(id));
        const instances = await this.workspaceDb.findInstancesByPhase(MANAGED_PHASES);
        for (let instance of instances) {
            const alreadyTakenCareOf =
                instance.controllerId && activeControllerIds.some((id) => id === instance.controllerId);
            const fromPreviousSelf = WorkspaceStartControllerId.isPreviousSelf(
                this.id,
                WorkspaceStartControllerId.fromString(instance.controllerId),
            );
            if (alreadyTakenCareOf && !fromPreviousSelf) {
                continue;
            }

            // No-one responsible yet/anymore: We take over
            try {
                log.info({ instanceId: instance.id }, "[wsc] taking control over instance", {
                    oldControllerId: instance.controllerId,
                    newControllerId: localControllerId,
                });
                instance = await this.workspaceDb.updateInstancePartial(instance.id, {
                    controllerId: localControllerId,
                });

                const triggerImmediately = fromPreviousSelf;
                this.doControlStartingWorkspace(instance, triggerImmediately).catch((err) =>
                    log.error(
                        { instanceId: instance.id },
                        "[wsc] error controlling instance after taking control",
                        err,
                        {
                            oldControllerId: instance.controllerId,
                            newControllerId: localControllerId,
                        },
                    ),
                ); // No need to await. Also, we don't want block the mutex for too long
            } catch (err) {
                log.warn({ instanceId: instance.id }, "[wsc] cannot set instance controller id", err, {
                    oldControllerId: instance.controllerId,
                    newControllerId: localControllerId,
                });
            }
        }
    }

    private async doControlStartingWorkspace(instance: WorkspaceInstance, triggerImmediately: boolean = false) {
        const localControllerId = this.getControllerId();
        if (instance.controllerId !== localControllerId) {
            return; // Not our business
        }

        return this.queue.enqueue(async () => {
            if (this.startingInstances.has(instance.id)) {
                return; // Already started
            }
            switch (instance.status.phase) {
                case "preparing":
                    this.retriggerStartWorkspace(instance).catch(log.error);
                    this.startingInstances.register(instance.id);
                    return;

                case "building":
                    this.retriggerStartWorkspace(instance).catch(log.error);
                    this.startingInstances.register(instance.id);
                    return;

                case "pending":
                    // !!! Note: during pending, the handover between app-cluster and ws-manager happens. !!!
                    // This means:
                    //  - there is a control loop on ws-manager-bridge that checks for an upper limit a instance may be in pending phase
                    //  - it will take some time after calling ws-manager to see the first status update
                    if (!triggerImmediately && durationLongerThanSeconds(Date.parse(instance.creationTime), 30)) {
                        // In 99.9% this is due to timing, so we need to be a bit cautious here not to spam ourselves.
                        return;
                    }

                    const exists = await this.existsWithWsManager(instance);
                    if (exists) {
                        // be a bit more patient and wait for the first status update
                        return;
                    }

                    // Our time has come!
                    this.retriggerStartWorkspace(instance).catch(log.error);
                    this.startingInstances.register(instance.id);
                    return;

                default:
                    return;
            }
        });
    }

    /**
     * This method will never throw, as it's not expected to be await'ed on.
     * @param instance
     */
    private async retriggerStartWorkspace(instance: WorkspaceInstance) {
        const span = TraceContext.startSpan("doRetriggerStartWorkspace");
        const logCtx: LogContext = { instanceId: instance.id, workspaceId: instance.workspaceId };
        try {
            log.info(logCtx, "[wsc] re-triggering startWorkspace", {
                controllerId: instance.controllerId,
                phase: instance.status.phase,
            });

            const workspace = await this.workspaceDb.findById(instance.workspaceId);
            if (!workspace) {
                throw new Error("cannot find workspace for instance");
            }
            const user = await this.userDb.findUserById(workspace.ownerId);
            if (!user) {
                throw new Error("cannot find owner for workspace");
            }

            const envVars = await this.envVarService.resolveEnvVariables(
                user.id,
                workspace.projectId,
                workspace.type,
                workspace.context,
            );
            await this.workspaceStarter.buildImageAndStartWorkspace({ span }, user, workspace, instance, envVars);
        } catch (err) {
            TraceContext.setError({ span }, err);
            log.error(logCtx, "[wsc] error re-triggering startWorkspace", err, {
                controllerId: instance.controllerId,
                phase: instance.status.phase,
            });
        } finally {
            span.finish();
        }
    }

    private async existsWithWsManager(instance: WorkspaceInstance): Promise<boolean> {
        const client = await this.getClient({ instanceId: instance.id }, instance.region);
        if (!client) return false;

        const req = new DescribeWorkspaceRequest();
        req.setId(instance.id);
        try {
            await client.describeWorkspace({}, req);
            return true;
        } catch (err) {
            return false;
        }
    }

    private async getClient(
        logCtx: LogContext,
        region: string,
    ): Promise<PromisifiedWorkspaceManagerClient | undefined> {
        try {
            return await this.clientProvider.get(region);
        } catch (err) {
            log.warn(logCtx, "[wsc] cannot get ws-manager client", err, { region });
            return undefined;
        }
    }

    public getControllerId(): string {
        return WorkspaceStartControllerId.toString(this.id);
    }
}

@injectable()
export class WorkspaceStartRegistry {
    private readonly startingInstances = new Set<string>();

    public has(instanceId: string): boolean {
        return this.startingInstances.has(instanceId);
    }

    public register(instanceId: string) {
        this.startingInstances.add(instanceId);
    }

    public unregister(instanceId: string) {
        this.startingInstances.delete(instanceId);
    }
}

/**
 * The properties we are after are:
 *  - unique per controlled restart (kubectl delete pod/rollout restart) (HOSTNAME)
 *  - human readable (this.config.version)
 *  - unique per container restart (this.initializationTime)
 * @returns
 */
interface WorkspaceStartControllerId {
    hostname: string;
    version: string;
    initializationTime: string;
}
namespace WorkspaceStartControllerId {
    const PREFIX = "wscid";
    export function create(version: string): WorkspaceStartControllerId {
        return {
            hostname: process.env.HOSTNAME || "unknown",
            version,
            initializationTime: new Date().toISOString(),
        };
    }
    export function fromString(str: string): WorkspaceStartControllerId | undefined {
        const [prefix, hostname, version, initializationTime] = str.split("_");
        if (prefix !== PREFIX || !hostname || !version || !initializationTime) {
            return undefined;
        }
        return { hostname, version, initializationTime };
    }
    export function toString(id: WorkspaceStartControllerId): string {
        return `${PREFIX}_${id.hostname}_${id.version}_${id.initializationTime}`;
    }
    export function isPreviousSelf(
        thisId: WorkspaceStartControllerId,
        previousId: WorkspaceStartControllerId | undefined,
    ): boolean {
        if (!previousId) {
            return false;
        }

        // We are the same pod+config as the other one, but we are newer.
        return (
            previousId.hostname === thisId.hostname &&
            previousId.version === thisId.version &&
            previousId.initializationTime < thisId.initializationTime
        );
    }
}
