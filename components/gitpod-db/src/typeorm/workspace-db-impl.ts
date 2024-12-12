/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    AdminGetWorkspacesQuery,
    CommitContext,
    PrebuildInfo,
    PrebuildWithStatus,
    PrebuiltWorkspace,
    PrebuiltWorkspaceState,
    PrebuiltWorkspaceUpdatable,
    RunningWorkspaceInfo,
    Snapshot,
    SnapshotState,
    Workspace,
    WorkspaceAndInstance,
    WorkspaceInfo,
    WorkspaceInstance,
    WorkspaceInstanceUser,
    WorkspaceSession,
    WorkspaceType,
} from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { daysBefore } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import * as crypto from "crypto";
import { inject, injectable, optional } from "inversify";
import { Brackets, DeepPartial, EntityManager, Repository } from "typeorm";
import { BUILTIN_WORKSPACE_PROBE_USER_ID } from "../user-db";
import {
    FindWorkspacesOptions,
    MaybeWorkspace,
    MaybeWorkspaceInstance,
    PrebuildWithWorkspace,
    PrebuildWithWorkspaceAndInstances,
    PrebuiltUpdatableAndWorkspace,
    WorkspaceAndOwner,
    WorkspaceDB,
    WorkspaceOwnerAndContentDeletedTime,
    WorkspaceOwnerAndDeletionEligibility,
    WorkspaceOwnerAndSoftDeleted,
    WorkspacePortsAuthData,
} from "../workspace-db";
import { DBPrebuildInfo } from "./entity/db-prebuild-info-entry";
import { DBPrebuiltWorkspace } from "./entity/db-prebuilt-workspace";
import { DBPrebuiltWorkspaceUpdatable } from "./entity/db-prebuilt-workspace-updatable";
import { DBSnapshot } from "./entity/db-snapshot";
import { DBWorkspace } from "./entity/db-workspace";
import { DBWorkspaceInstance } from "./entity/db-workspace-instance";
import { DBWorkspaceInstanceUser } from "./entity/db-workspace-instance-user";
import {
    reportPrebuildInfoPurged,
    reportPrebuiltWorkspacePurged,
    reportPrebuiltWorkspaceUpdatablePurged,
    reportWorkspaceInstancePurged,
    reportWorkspacePurged,
} from "./metrics";
import { TransactionalDBImpl } from "./transactional-db-impl";
import { TypeORM } from "./typeorm";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { DBProject } from "./entity/db-project";
import { PrebuiltWorkspaceWithWorkspace } from "@gitpod/gitpod-protocol/src/protocol";

type RawTo<T> = (instance: WorkspaceInstance, ws: Workspace) => T;
interface OrderBy {
    fqField: string;
    order: "ASC" | "DESC";
}

@injectable()
export class TypeORMWorkspaceDBImpl extends TransactionalDBImpl<WorkspaceDB> implements WorkspaceDB {
    constructor(@inject(TypeORM) typeorm: TypeORM, @optional() transactionalEM?: EntityManager) {
        super(typeorm, transactionalEM);
    }

    protected createTransactionalDB(transactionalEM: EntityManager): WorkspaceDB {
        return new TypeORMWorkspaceDBImpl(this.typeorm, transactionalEM);
    }

    private async getWorkspaceRepo(): Promise<Repository<DBWorkspace>> {
        return (await this.getEntityManager()).getRepository<DBWorkspace>(DBWorkspace);
    }

    private async getWorkspaceInstanceRepo(): Promise<Repository<DBWorkspaceInstance>> {
        return (await this.getEntityManager()).getRepository<DBWorkspaceInstance>(DBWorkspaceInstance);
    }

    private async getWorkspaceInstanceUserRepo(): Promise<Repository<DBWorkspaceInstanceUser>> {
        return (await this.getEntityManager()).getRepository<DBWorkspaceInstanceUser>(DBWorkspaceInstanceUser);
    }

    private async getSnapshotRepo(): Promise<Repository<DBSnapshot>> {
        return (await this.getEntityManager()).getRepository<DBSnapshot>(DBSnapshot);
    }

    private async getPrebuiltWorkspaceRepo(): Promise<Repository<DBPrebuiltWorkspace>> {
        return (await this.getEntityManager()).getRepository<DBPrebuiltWorkspace>(DBPrebuiltWorkspace);
    }

    private async getPrebuildInfoRepo(): Promise<Repository<DBPrebuildInfo>> {
        return (await this.getEntityManager()).getRepository<DBPrebuildInfo>(DBPrebuildInfo);
    }

    private async getPrebuiltWorkspaceUpdatableRepo(): Promise<Repository<DBPrebuiltWorkspaceUpdatable>> {
        return (await this.getEntityManager()).getRepository<DBPrebuiltWorkspaceUpdatable>(
            DBPrebuiltWorkspaceUpdatable,
        );
    }

    public async connect(maxTries: number = 3, timeout: number = 2000): Promise<void> {
        let tries = 1;
        while (tries <= maxTries) {
            try {
                await this.getEntityManager();
                return;
            } catch (err) {
                log.error(`DB connection error (attempt ${tries} of ${maxTries})`, err);
                await new Promise((resolve) => setTimeout(resolve, timeout));
            }
            tries++;
        }
        throw new Error("Could not establish connection to database!");
    }

    async storeInstance(instance: WorkspaceInstance): Promise<WorkspaceInstance> {
        const inst = await this.internalStoreInstance(instance);
        return inst;
    }

    public async findRunningInstance(workspaceId: string): Promise<MaybeWorkspaceInstance> {
        const instance = await this.findCurrentInstance(workspaceId);
        if (instance && instance.status.phase !== "stopped") {
            return instance;
        }
        return undefined;
    }

    public async store(workspace: Workspace) {
        const workspaceRepo = await this.getWorkspaceRepo();
        const dbWorkspace = workspace as DBWorkspace;

        // `cloneUrl` is stored redundandly to optimize for `getWorkspaceCountByCloneURL`.
        // As clone URLs are lesser constrained we want to shorten the value to work well with the indexed column.
        if (CommitContext.is(dbWorkspace.context)) {
            const cloneUrl = this.toCloneUrl255(dbWorkspace.context.repository.cloneUrl);
            dbWorkspace.cloneUrl = cloneUrl;
        }
        return await workspaceRepo.save(dbWorkspace);
    }

    private toCloneUrl255(cloneUrl: string) {
        if (cloneUrl.length > 255) {
            return `cloneUrl-sha:${crypto.createHash("sha256").update(cloneUrl, "utf8").digest("hex")}`;
        }
        return cloneUrl;
    }

    public async updatePartial(workspaceId: string, partial: DeepPartial<Workspace>) {
        const workspaceRepo = await this.getWorkspaceRepo();
        await workspaceRepo.update(workspaceId, partial);
    }

    public async findById(id: string): Promise<MaybeWorkspace> {
        const workspaceRepo = await this.getWorkspaceRepo();
        return workspaceRepo.findOne(id);
    }

    public async findByInstanceId(instanceId: string): Promise<MaybeWorkspace> {
        const instanceRepo = await this.getWorkspaceInstanceRepo();
        const instance = await instanceRepo.findOne(instanceId);
        if (!instance) {
            return undefined;
        }
        return this.findById(instance.workspaceId);
    }

    public async find(options: FindWorkspacesOptions): Promise<WorkspaceInfo[]> {
        /**
         * With this query we want to list all user workspaces by lastActivity and include the latestWorkspaceInstance (if present).
         * Implementation notes:
         *  - Explanation for ORDER BY wsiRunning DESC:
         *    - we want running workspaces to always be on the top. wsiRunning is non-NULL if a workspace is running,
         *      so sorting will bump it to the top
         *  - Explanation for ORDER BY GREATEST(...):
         *    - we want to sort workspaces by last activity
         *    - all fields are string fields, defaulting to empty string (not NULL!), containing ISO date strings (which are sortable by date)
         *      thus GREATEST gives us the highest (newest) timestamp on the running instance which correlates to the last activity on that workspace
         */
        const repo = await this.getWorkspaceRepo();
        const qb = repo
            .createQueryBuilder("ws")
            // We need to put the subquery into the join condition (ON) here to be able to reference `ws.id` which is
            // not possible in a subquery on JOIN (e.g. 'LEFT JOIN (SELECT ... WHERE i.workspaceId = ws.id)')
            .leftJoinAndMapOne(
                "ws.latestInstance",
                DBWorkspaceInstance,
                "wsi",
                `wsi.id = (SELECT i.id FROM d_b_workspace_instance AS i WHERE i.workspaceId = ws.id ORDER BY i.creationTime DESC LIMIT 1)`,
            )
            .leftJoin(
                (qb) => {
                    return qb
                        .select("workspaceId")
                        .from(DBWorkspaceInstance, "i2")
                        .where('i2.phasePersisted = "running"');
                },
                "wsiRunning",
                "ws.id = wsiRunning.workspaceId",
            )
            .where("ws.ownerId = :userId", { userId: options.userId })
            .andWhere("ws.softDeletedTime = ''") // enables usage of: ind_softDeletion
            .andWhere("ws.softDeleted IS NULL")
            .andWhere("ws.deleted != TRUE")
            .orderBy("wsiRunning.workspaceId", "DESC")
            .addOrderBy("GREATEST(ws.creationTime, wsi.creationTime, wsi.startedTime, wsi.stoppedTime)", "DESC")
            .limit(options.limit || 10);
        if (options.searchString) {
            qb.andWhere("ws.description LIKE :searchString", { searchString: `%${options.searchString}%` });
        }
        if (!options.includeHeadless) {
            qb.andWhere("ws.type = 'regular'");
        }
        if (options.pinnedOnly) {
            qb.andWhere("ws.pinned = true");
        }
        if (options.organizationId) {
            qb.andWhere("ws.organizationId = :organizationId", { organizationId: options.organizationId });
        }
        const projectIds = typeof options.projectId === "string" ? [options.projectId] : options.projectId;
        if (projectIds !== undefined) {
            if (projectIds.length === 0 && !options.includeWithoutProject) {
                // user passed an empty array of projectids and also is not interested in unassigned workspaces -> no results
                return [];
            }
            qb.andWhere(
                new Brackets((qb) => {
                    // there is a schema mismatch: we use a transformer to map to empty string, but have a column-default of NULL.
                    // Thus all legacy workspaces (before the introduction of projectId) have a NULL in this column; all afterwards an empty string.
                    const emptyProjectId = "(ws.projectId IS NULL OR ws.projectId = '')";
                    if (projectIds.length > 0) {
                        qb.where("ws.projectId IN (:pids)", { pids: projectIds });
                        if (options.includeWithoutProject) {
                            qb.orWhere(emptyProjectId);
                        }
                    } else if (options.includeWithoutProject) {
                        qb.where(emptyProjectId);
                    }
                }),
            );
        }
        const rawResults = (await qb.getMany()) as any as (Workspace & { latestInstance?: WorkspaceInstance })[]; // see leftJoinAndMapOne above
        return rawResults.map((r) => {
            const workspace = { ...r };
            delete workspace.latestInstance;
            return {
                workspace,
                latestInstance: r.latestInstance,
            };
        });
    }

    public async updateLastHeartbeat(
        instanceId: string,
        userId: string,
        newHeartbeat: Date,
        wasClosed?: boolean,
    ): Promise<void> {
        const query =
            "INSERT INTO d_b_workspace_instance_user(instanceId, userId, lastSeen) VALUES (?, ?, timestamp ?) ON DUPLICATE KEY UPDATE lastSeen = timestamp ?, wasClosed = ?";
        const lastSeen = this.toTimestampString(newHeartbeat);
        const workspaceInstanceUserRepo = await this.getWorkspaceInstanceUserRepo();
        await workspaceInstanceUserRepo.query(query, [instanceId, userId, lastSeen, lastSeen, wasClosed || false]);
    }

    private toTimestampString(date: Date) {
        return date.toISOString().split(".")[0];
    }

    public async getLastOwnerHeartbeatFor(
        instance: WorkspaceInstance,
    ): Promise<{ lastSeen: Date; wasClosed?: boolean } | undefined> {
        const query =
            "SELECT `DBWorkspaceInstanceUser`.`lastSeen` AS `lastSeen`,`DBWorkspaceInstanceUser`.`wasClosed` AS `wasClosed` FROM `d_b_workspace_instance_user` `DBWorkspaceInstanceUser` WHERE `DBWorkspaceInstanceUser`.`instanceId`=? AND `DBWorkspaceInstanceUser`.`userId`=(SELECT `ws`.`ownerId` AS `ws_ownerId` FROM `d_b_workspace` `ws` WHERE `ws`.`id` = ? LIMIT 1)";
        const workspaceInstanceUserRepo = await this.getWorkspaceInstanceUserRepo();
        const result = await workspaceInstanceUserRepo.query(query, [instance.id, instance.workspaceId]);

        if (result && result.length > 0 && result[0].lastSeen) {
            return {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                lastSeen: new Date(result[0].lastSeen),
                wasClosed: Boolean(result[0].wasClosed),
            };
        }
        return undefined;
    }

    public async getWorkspaceUsers(workspaceId: string, minLastSeen: number): Promise<WorkspaceInstanceUser[]> {
        const repo = await this.getWorkspaceInstanceUserRepo();
        const minLastSeenString = this.toTimestampString(new Date(new Date().getTime() - minLastSeen));
        const query =
            "SELECT wsiu.instanceId as instanceId, wsiu.userId as userId, wsiu.lastSeen as lastSeen, user.avatarUrl as avatarUrl, user.name as name FROM d_b_workspace_instance_user wsiu, d_b_user user, d_b_workspace_instance wsi WHERE user.id = wsiu.userId AND wsi.id = wsiu.instanceId AND wsi.workspaceId = ? AND wsiu.lastSeen > (timestamp ?)";
        return repo.query(query, [workspaceId, minLastSeenString]);
    }

    public async internalStoreInstance(instance: WorkspaceInstance): Promise<WorkspaceInstance> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        const dbInstance = instance as DBWorkspaceInstance;
        dbInstance.phasePersisted = dbInstance.status.phase;
        return await workspaceInstanceRepo.save(dbInstance);
    }

    public async updateInstancePartial(
        instanceId: string,
        partial: DeepPartial<WorkspaceInstance>,
    ): Promise<WorkspaceInstance> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        if (!!partial.status) {
            (partial as any).phasePersisted = partial.status.phase;
        }
        await workspaceInstanceRepo.update(instanceId, partial);
        return (await this.findInstanceById(instanceId))!;
    }

    public async findInstanceById(workspaceInstanceId: string): Promise<MaybeWorkspaceInstance> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        return workspaceInstanceRepo.findOne(workspaceInstanceId);
    }

    public async findInstances(workspaceId: string): Promise<WorkspaceInstance[]> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        const qBuilder = workspaceInstanceRepo
            .createQueryBuilder("wsi")
            .where("wsi.workspaceId = :workspaceId", { workspaceId })
            .orderBy("creationTime", "ASC");
        return qBuilder.getMany();
    }

    public async findWorkspacesByUser(userId: string): Promise<Workspace[]> {
        const workspaceRepo = await this.getWorkspaceRepo();
        return workspaceRepo.find({ ownerId: userId });
    }

    public async getWorkspaceCountByCloneURL(
        cloneURL: string,
        sinceLastDays: number = 7,
        type: string = "regular",
    ): Promise<number> {
        const workspaceRepo = await this.getWorkspaceRepo();
        const since = new Date();
        since.setDate(since.getDate() - sinceLastDays);
        return workspaceRepo
            .createQueryBuilder("ws")
            .where("cloneURL = :cloneURL", { cloneURL: this.toCloneUrl255(cloneURL) })
            .andWhere("creationTime > :since", { since: since.toISOString() })
            .andWhere("type = :type", { type })
            .getCount();
    }

    public async findCurrentInstance(workspaceId: string): Promise<MaybeWorkspaceInstance> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        const qb = workspaceInstanceRepo
            .createQueryBuilder("wsi")
            .where(`wsi.workspaceId = :workspaceId`, { workspaceId })
            .orderBy("creationTime", "DESC")
            .limit(1);
        return qb.getOne();
    }

    public async getInstanceCount(type?: string): Promise<number> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        const queryBuilder = workspaceInstanceRepo
            .createQueryBuilder("wsi")
            .leftJoinAndMapOne("wsi.workspace", DBWorkspace, "ws", "wsi.workspaceId = ws.id")
            .where("ws.type = :type", { type: type ? type.toString() : "regular" }); // only regular workspaces by default

        return await queryBuilder.getCount();
    }

    public async findRegularRunningInstances(userId?: string): Promise<WorkspaceInstance[]> {
        const infos = await this.findRunningInstancesWithWorkspaces(undefined, userId);
        return infos.filter((info) => info.workspace.type === "regular").map((wsinfo) => wsinfo.latestInstance);
    }

    public async findRunningInstancesWithWorkspaces(
        workspaceClusterName?: string,
        userId?: string,
        includeStopping: boolean = false,
    ): Promise<RunningWorkspaceInfo[]> {
        const params: { region?: string } = {};
        const conditions = ["wsi.phasePersisted != 'stopped'", "wsi.deleted != TRUE"];
        if (!includeStopping) {
            // This excludes instances in a 'stopping' phase
            conditions.push("wsi.phasePersisted != 'stopping'");
        }
        if (workspaceClusterName) {
            params.region = workspaceClusterName;
            conditions.push("wsi.region = :region");
        }
        const joinParams: { userId?: string } = {};
        const joinConditions = [];
        if (userId) {
            joinParams.userId = userId;
            joinConditions.push("ws.ownerId = :userId");
        }
        return this.doJoinInstanceWithWorkspace<RunningWorkspaceInfo>(
            conditions,
            params,
            joinConditions,
            joinParams,
            (wsi, ws) => {
                return { workspace: ws, latestInstance: wsi };
            },
        );
    }

    public async findWorkspacePortsAuthDataById(workspaceId: string): Promise<WorkspacePortsAuthData | undefined> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        const results = (await workspaceInstanceRepo.query(
            `
                SELECT wsi.id AS wsi_id,
                        wsi.region AS wsi_region,
                        ws.id AS ws_id,
                        ws.ownerId AS ws_ownerId,
                        ws.shareable AS ws_shareable
                    FROM d_b_workspace_instance AS wsi
                    INNER JOIN d_b_workspace AS ws
                        ON wsi.workspaceId = ws.id
                    WHERE wsi.workspaceId = ?
                    ORDER BY wsi.creationTime DESC
                    LIMIT 1;
            `,
            [workspaceId],
        )) as any[];
        if (results.length < 1) {
            return undefined;
        }

        const res = results[0];
        return {
            workspace: {
                id: res.ws_id,
                ownerId: res.ws_ownerId,
                shareable: res.ws_shareable,
            },
            instance: {
                id: res.wsi_id,
                region: res.wsi_region,
            },
        };
    }

    public async findSessionsInPeriod(
        organizationId: string,
        periodStart: Date,
        periodEnd: Date,
        limit: number,
        offset: number,
    ): Promise<WorkspaceSession[]> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        // The query basically selects all workspace instances for the given owner, whose startDate is within the period, and which are either:
        //  - not stopped yet, or
        //  - is stopped or stopping.
        const sessions = await workspaceInstanceRepo
            .createQueryBuilder("wsi")
            .leftJoinAndMapOne("wsi.workspace", DBWorkspace, "ws", "ws.id = wsi.workspaceId")
            .where("ws.organizationId = :organizationId", { organizationId })
            .andWhere("wsi.creationTime >= :periodStart", { periodStart: periodStart.toISOString() })
            .andWhere("wsi.creationTime <= :periodEnd", { periodEnd: periodEnd.toISOString() })
            .orderBy("wsi.creationTime", "DESC")
            .skip(offset)
            .take(limit)
            .getMany();

        const resultSessions: { instance: WorkspaceInstance; workspace: Workspace }[] = [];
        for (const session of sessions) {
            resultSessions.push({
                workspace: (session as any).workspace,
                instance: session,
            });
            delete (session as any).workspace;
        }
        return resultSessions;
    }

    public async findEligibleWorkspacesForSoftDeletion(
        cutOffDate: Date = new Date(),
        limit: number = 100,
        type: WorkspaceType = "regular",
    ): Promise<WorkspaceOwnerAndDeletionEligibility[]> {
        if (cutOffDate > new Date()) {
            throw new Error("cutOffDate must not be in the future, was: " + cutOffDate.toISOString());
        }
        const workspaceRepo = await this.getWorkspaceRepo();
        const dbResults = await workspaceRepo.query(
            `
                SELECT ws.id AS id,
                       ws.ownerId AS ownerId,
                       ws.deletionEligibilityTime AS deletionEligibilityTime
                    FROM d_b_workspace AS ws
                    WHERE ws.deleted = 0
                        AND ws.type = ?
                        AND ws.softDeleted IS NULL
                        AND ws.softDeletedTime = ''
                        AND ws.pinned = 0
                        AND ws.deletionEligibilityTime != ''
                        AND ws.deletionEligibilityTime < ?
                    LIMIT ?;
            `,
            [type, cutOffDate.toISOString(), limit],
        );

        return dbResults as WorkspaceAndOwner[];
    }

    public async findWorkspacesForPurging(
        minContentDeletionTimeInDays: number,
        limit: number,
        now: Date,
    ): Promise<WorkspaceOwnerAndContentDeletedTime[]> {
        const minPurgeTime = daysBefore(now.toISOString(), minContentDeletionTimeInDays);
        const repo = await this.getWorkspaceRepo();
        const qb = repo
            .createQueryBuilder("ws")
            .select(["ws.id", "ws.ownerId", "ws.contentDeletedTime"])
            .where(`ws.contentDeletedTime != ''`)
            .andWhere(`ws.contentDeletedTime < :minPurgeTime`, { minPurgeTime })
            .andWhere(`ws.deleted = 0`)
            .limit(limit);
        return await qb.getMany();
    }

    public async findWorkspacesForContentDeletion(
        minSoftDeletedTimeInDays: number,
        limit: number,
    ): Promise<WorkspaceOwnerAndSoftDeleted[]> {
        const workspaceRepo = await this.getWorkspaceRepo();
        const dbResults = await workspaceRepo.query(
            `
                SELECT ws.id AS id,
                       ws.ownerId AS ownerId,
                       ws.softDeleted as softDeleted
                    FROM d_b_workspace AS ws
                    WHERE	ws.deleted = 0
                        AND ws.contentDeletedTime = ''
                        AND ws.softDeleted IS NOT NULL
                        AND (
                                    ws.softDeletedTime < NOW() - INTERVAL ? DAY
                                OR  ws.softDeletedTime = ''
                            )
                        AND ws.ownerId <> ?
                    LIMIT ?;
            `,
            [minSoftDeletedTimeInDays, BUILTIN_WORKSPACE_PROBE_USER_ID, limit],
        );

        return dbResults as WorkspaceOwnerAndSoftDeleted[];
    }

    private async doJoinInstanceWithWorkspace<T>(
        conditions: string[],
        conditionParams: {},
        joinConditions: string[],
        joinConditionParams: {},
        map: RawTo<T>,
        orderBy?: OrderBy,
    ): Promise<T[]> {
        type InstanceJoinResult = DBWorkspaceInstance & { workspace: Workspace };

        joinConditions = ["wsi.workspaceId = ws.id", ...joinConditions]; // Basic JOIN condition
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        let qb = workspaceInstanceRepo
            .createQueryBuilder("wsi")
            .where(conditions.join(" AND "), conditionParams)
            .innerJoinAndMapOne("wsi.workspace", DBWorkspace, "ws", joinConditions.join(" AND "), joinConditionParams);
        if (orderBy) {
            qb = qb.orderBy(orderBy.fqField, orderBy.order);
        }
        const rawResult: InstanceJoinResult[] = (await qb.getMany()) as InstanceJoinResult[];
        return rawResult.map((raw: InstanceJoinResult): T => {
            const ws = raw.workspace;
            // @ts-ignore
            delete raw.workspace;
            const wsi = raw;
            return map(wsi, ws);
        });
    }

    public async findSnapshotById(snapshotId: string): Promise<Snapshot | undefined> {
        const snapshots = await this.getSnapshotRepo();
        return snapshots.findOne(snapshotId);
    }
    public async findSnapshotsWithState(
        state: SnapshotState,
        offset: number,
        limit: number,
    ): Promise<{ snapshots: Snapshot[]; total: number }> {
        const snapshotRepo = await this.getSnapshotRepo();
        const [snapshots, total] = await snapshotRepo
            .createQueryBuilder("snapshot")
            .where("snapshot.state = :state", { state })
            .orderBy("creationTime", "ASC")
            .offset(offset)
            .take(limit)
            .getManyAndCount();
        return { snapshots, total };
    }

    public async storeSnapshot(snapshot: Snapshot): Promise<Snapshot> {
        const snapshots = await this.getSnapshotRepo();
        const dbSnapshot = snapshot as DBSnapshot;
        return await snapshots.save(dbSnapshot);
    }

    public async deleteSnapshot(snapshotId: string): Promise<void> {
        const snapshots = await this.getSnapshotRepo();
        await snapshots.delete(snapshotId);
    }

    public async updateSnapshot(snapshot: DeepPartial<Snapshot> & Pick<Snapshot, "id">): Promise<void> {
        const snapshots = await this.getSnapshotRepo();
        await snapshots.update(snapshot.id, snapshot);
    }

    public async findSnapshotsByWorkspaceId(workspaceId: string): Promise<Snapshot[]> {
        const snapshots = await this.getSnapshotRepo();
        return snapshots.find({ where: { originalWorkspaceId: workspaceId } });
    }

    public async storePrebuiltWorkspace(pws: PrebuiltWorkspace): Promise<PrebuiltWorkspace> {
        const repo = await this.getPrebuiltWorkspaceRepo();
        if (pws.error && pws.error.length > 255) {
            pws.error = pws.error.substring(0, 251) + " ...";
        }
        return await repo.save(pws as DBPrebuiltWorkspace);
    }

    // Find the (last triggered) prebuild for a given commit
    public async findPrebuiltWorkspaceByCommit(
        projectId: string,
        commit: string,
    ): Promise<PrebuiltWorkspace | undefined> {
        if (!commit || !projectId) {
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "Illegal arguments", { projectId, commit });
        }
        const repo = await this.getPrebuiltWorkspaceRepo();
        return await repo
            .createQueryBuilder("pws")
            .where("pws.projectId = :projectId AND pws.commit LIKE :commit", {
                projectId,
                commit: commit + "%",
            })
            .orderBy("pws.creationTime", "DESC")
            .innerJoinAndMapOne(
                "pws.workspace",
                DBWorkspace,
                "ws",
                "pws.buildWorkspaceId = ws.id and ws.contentDeletedTime = ''",
            )
            .getOne();
    }

    public async findActivePrebuiltWorkspacesByBranch(
        projectId: string,
        branch: string,
    ): Promise<PrebuildWithWorkspaceAndInstances[]> {
        if (!branch) {
            return [];
        }
        const repo = await this.getPrebuiltWorkspaceRepo();
        const result = await repo
            .createQueryBuilder("pws")
            .where(
                "(pws.state = 'queued' OR pws.state = 'building') AND pws.projectId = :projectId AND pws.branch = :branch",
                { projectId, branch },
            )
            .orderBy("pws.creationTime", "DESC")
            .innerJoinAndMapOne(
                "pws.workspace",
                DBWorkspace,
                "ws",
                "pws.buildWorkspaceId = ws.id and ws.contentDeletedTime = ''",
            )
            .innerJoinAndMapMany("pws.instances", DBWorkspaceInstance, "wsi", "pws.buildWorkspaceId = wsi.workspaceId")
            .getMany();
        return result.map((r) => {
            return {
                prebuild: r,
                workspace: (<any>r).workspace,
                instances: (<any>r).instances,
            };
        });
    }

    public async findPrebuildByWorkspaceID(wsid: string): Promise<PrebuiltWorkspace | undefined> {
        const repo = await this.getPrebuiltWorkspaceRepo();
        return await repo
            .createQueryBuilder("pws")
            .innerJoin(DBWorkspace, "ws", "pws.buildWorkspaceId = ws.id")
            .where("pws.buildWorkspaceId = :wsid", { wsid })
            .andWhere("ws.contentDeletedTime = ''")
            .getOne();
    }

    public async findPrebuildByID(pwsid: string): Promise<PrebuiltWorkspace | undefined> {
        const repo = await this.getPrebuiltWorkspaceRepo();
        return await repo
            .createQueryBuilder("pws")
            .innerJoin(DBWorkspace, "ws", "pws.buildWorkspaceId = ws.id")
            .where("pws.id = :pwsid", { pwsid })
            .andWhere("ws.contentDeletedTime = ''")
            .getOne();
    }

    public async findPrebuildsWithWorkspace(projectId: string): Promise<PrebuildWithWorkspace[]> {
        const repo = await this.getPrebuiltWorkspaceRepo();

        let query = repo.createQueryBuilder("pws");
        query = query.where("pws.projectId = :projectId", { projectId });
        query = query.orderBy("pws.creationTime", "DESC");
        query = query.innerJoinAndMapOne("pws.workspace", DBWorkspace, "ws", "pws.buildWorkspaceId = ws.id");
        query = query.andWhere("ws.deleted = false");
        query = query.andWhere("ws.contentDeletedTime = ''");

        const res = await query.getMany();
        return res.map((r) => {
            const withWorkspace: PrebuiltWorkspace & { workspace: Workspace } = r as any;
            return {
                prebuild: r,
                workspace: withWorkspace.workspace,
            };
        });
    }

    public async findPrebuildWithStatus(prebuildId: string): Promise<PrebuildWithStatus | undefined> {
        const pbws = await this.findPrebuiltWorkspaceById(prebuildId);
        if (!pbws) {
            return undefined;
        }
        const [info, workspace, instance] = await Promise.all([
            this.findPrebuildInfos([prebuildId]).then((infos) => (infos.length > 0 ? infos[0] : undefined)),
            this.findById(pbws.buildWorkspaceId),
            this.findCurrentInstance(pbws.buildWorkspaceId),
        ]);
        if (!info || !workspace) {
            return undefined;
        }
        const result: PrebuildWithStatus = { info, status: pbws.state, workspace, instance };
        if (pbws.error) {
            result.error = pbws.error;
        }
        return result;
    }

    public async countUnabortedPrebuildsSince(projectId: string, date: Date): Promise<number> {
        const abortedState: PrebuiltWorkspaceState = "aborted";
        const repo = await this.getPrebuiltWorkspaceRepo();

        let query = repo.createQueryBuilder("pws");
        query = query.where("pws.projectId = :projectId", { projectId });
        query = query.andWhere("pws.creationTime >= :time", { time: date.toISOString() });
        query = query.andWhere("pws.state != :state", { state: abortedState });
        return query.getCount();
    }

    public async attachUpdatableToPrebuild(pwsid: string, update: PrebuiltWorkspaceUpdatable): Promise<void> {
        const repo = await this.getPrebuiltWorkspaceUpdatableRepo();
        await repo.save(update);
    }
    public async findUpdatablesForPrebuild(pwsid: string): Promise<PrebuiltWorkspaceUpdatable[]> {
        const repo = await this.getPrebuiltWorkspaceUpdatableRepo();
        return await repo.createQueryBuilder("pwsu").where("pwsu.prebuiltWorkspaceId = :pwsid", { pwsid }).getMany();
    }
    public async markUpdatableResolved(updatableId: string): Promise<void> {
        const repo = await this.getPrebuiltWorkspaceUpdatableRepo();
        await repo.update(updatableId, { isResolved: true });
    }
    public async getUnresolvedUpdatables(limit?: number): Promise<PrebuiltUpdatableAndWorkspace[]> {
        const pwsuRepo = await this.getPrebuiltWorkspaceUpdatableRepo();

        // select * from d_b_prebuilt_workspace_updatable as pwsu left join d_b_prebuilt_workspace pws ON pws.id = pwsu.prebuiltWorkspaceId left join d_b_workspace ws on pws.buildWorkspaceId = ws.id left join d_b_workspace_instance wsi on ws.id = wsi.workspaceId where pwsu.isResolved = 0
        const query = pwsuRepo
            .createQueryBuilder("pwsu")
            .innerJoinAndMapOne("pwsu.prebuild", DBPrebuiltWorkspace, "pws", "pwsu.prebuiltWorkspaceId = pws.id")
            .innerJoinAndMapOne("pwsu.workspace", DBWorkspace, "ws", "pws.buildWorkspaceId = ws.id")
            .where("pwsu.isResolved = 0")
            .orderBy("ws.creationTime", "DESC");

        if (!!limit) {
            query.limit(limit);
        }

        return (await query.getMany()) as any;
    }

    /**
     * This *hard deletes* the workspace entry and all corresponding workspace-instances, by triggering a periodic deleter mechanism that purges it from the DB.
     * Note: when this function returns that doesn't mean that the entries are actually gone yet, that might still take a short while until periodic deleter comes
     *       around to deleting them.
     */
    public async hardDeleteWorkspace(workspaceId: string): Promise<void> {
        const logCtx = { workspaceId };
        const prebuild = await this.findPrebuildByWorkspaceID(workspaceId);
        if (prebuild !== undefined) {
            // There are prebuilds linked to this workspace. We need to delete these first.
            const prebuildsDeleted = await (await this.getPrebuiltWorkspaceRepo()).delete({ id: prebuild.id });
            log.info(logCtx, `Hard deleted ${prebuildsDeleted.affected} prebuilds.`);
            reportPrebuiltWorkspacePurged(prebuildsDeleted.affected || 0);

            const updatableDeletes = await (await this.getPrebuiltWorkspaceUpdatableRepo()).delete({ id: prebuild.id });
            log.info(logCtx, `Hard deleted ${updatableDeletes.affected} prebuild updatables.`);
            reportPrebuiltWorkspaceUpdatablePurged(updatableDeletes.affected || 0);

            const prebuildInfos = await (await this.getPrebuildInfoRepo()).delete({ prebuildId: prebuild.id });
            log.info(logCtx, `Hard deleted ${prebuildInfos.affected} prebuild infos.`);
            reportPrebuildInfoPurged(prebuildInfos.affected || 0);
        }
        const instances = await (await this.getWorkspaceInstanceRepo()).delete({ workspaceId });
        log.info(logCtx, `Hard deleted ${instances.affected} workspace instances.`);
        reportWorkspaceInstancePurged(instances.affected || 0);

        const workspaces = await (await this.getWorkspaceRepo()).delete({ id: workspaceId });
        log.info(logCtx, `Hard deleted ${workspaces.affected} workspaces.`);
        reportWorkspacePurged(workspaces.affected || 0);
    }

    public async findAllWorkspaces(
        offset: number,
        limit: number,
        orderBy: keyof Workspace,
        orderDir: "ASC" | "DESC",
        opts: {
            ownerId?: string;
            type?: WorkspaceType;
        },
    ): Promise<{ total: number; rows: Workspace[] }> {
        const workspaceRepo = await this.getWorkspaceRepo();
        const queryBuilder = workspaceRepo.createQueryBuilder("ws").skip(offset).take(limit).orderBy(orderBy, orderDir);
        if (opts.type) {
            queryBuilder.andWhere("ws.type = :type", { type: opts.type.toString() });
        }

        if (opts.ownerId) {
            queryBuilder.andWhere("ownerId = :ownerId", { ownerId: opts.ownerId });
        }
        const [rows, total] = await queryBuilder.getManyAndCount();
        return { total, rows };
    }

    public async getWorkspaceCount(type?: String): Promise<Number> {
        const workspaceRepo = await this.getWorkspaceRepo();
        const queryBuilder = workspaceRepo
            .createQueryBuilder("ws")
            .where("ws.type = :type", { type: type ? type.toString() : "regular" }); // only regular workspaces by default

        return await queryBuilder.getCount();
    }

    public async findAllWorkspaceAndInstances(
        offset: number,
        limit: number,
        orderBy: keyof WorkspaceAndInstance,
        orderDir: "ASC" | "DESC",
        query?: AdminGetWorkspacesQuery,
    ): Promise<{ total: number; rows: WorkspaceAndInstance[] }> {
        const whereConditions = [];
        const whereConditionParams: any = {};
        let instanceIdQuery: boolean = false;

        if (query) {
            // from most to least specific so we don't generalize accidentally
            if (query.instanceIdOrWorkspaceId) {
                whereConditions.push("(wsi.id = :instanceId OR ws.id = :workspaceId)");
                whereConditionParams.instanceId = query.instanceIdOrWorkspaceId;
                whereConditionParams.workspaceId = query.instanceIdOrWorkspaceId;
            } else if (query.workspaceId) {
                whereConditions.push("ws.id = :workspaceId");
                whereConditionParams.workspaceId = query.workspaceId;
            } else if (query.ownerId) {
                // If an owner id is provided only search for workspaces belonging to that user.
                whereConditions.push("ws.ownerId = :ownerId");
                whereConditionParams.ownerId = query.ownerId;
            } else if (query.instanceId) {
                // in addition to adding "instanceId" to the "WHERE" clause like for the other workspace-guided queries,
                // we modify the JOIN condition below to a) select the correct instance and b) make the query faster
                instanceIdQuery = true;

                whereConditions.push("wsi.id = :instanceId");
                whereConditionParams.instanceId = query.instanceId;
            }
        }

        let orderField: string = orderBy;
        switch (orderField) {
            case "workspaceId":
                orderField = "ws.id";
                break;
            case "instanceId":
                orderField = "wsi.id";
                break;
            case "contextURL":
                orderField = "ws.contextURL";
                break;
            case "workspaceCreationTime":
                orderField = "ws.creationTime";
                break;
            case "instanceCreationTime":
                orderField = "wsi.creationTime";
                break;
            case "phase":
                orderField = "wsi.status->>phase";
                break;
            case "ownerId":
                orderField = "wsi.ownerId";
                break;
        }

        // We need to select the latest wsi for a workspace. It's the same problem we have in 'find' (the "/workspaces" query, see above), so we use the same approach.
        // Only twist is that we might be searching for an instance directly ('instanceIdQuery').
        const workspaceRepo = await this.getWorkspaceRepo();
        const qb = workspaceRepo
            .createQueryBuilder("ws")
            // We need to put the subquery into the join condition (ON) here to be able to reference `ws.id` which is
            // not possible in a subquery on JOIN (e.g. 'LEFT JOIN (SELECT ... WHERE i.workspaceId = ws.id)')
            .innerJoinAndMapOne(
                "ws.instance",
                DBWorkspaceInstance,
                "wsi",
                `${
                    instanceIdQuery
                        ? "wsi.workspaceId = ws.id"
                        : "wsi.id = (SELECT i.id FROM d_b_workspace_instance AS i WHERE i.workspaceId = ws.id ORDER BY i.creationTime DESC LIMIT 1)"
                }`,
            )
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            .where(whereConditions.join(" AND "), whereConditionParams)
            .orderBy(orderField, orderDir)
            .take(limit)
            .skip(offset);

        const rawResult = (await qb.getMany()) as InstanceJoinResult[];
        const total = await qb.getCount();
        const rows = (rawResult as InstanceJoinResult[]).map((r) => {
            const res = {
                ...r,
                ...r.instance,
                workspaceId: r.id,
                instanceId: r.instance.id,
                workspaceCreationTime: r.creationTime,
                instanceCreationTime: r.instance.creationTime,
                phase: r.instance.status.phase,
            };
            // @ts-ignore
            delete res["id"];
            // @ts-ignore
            delete res["creationTime"];
            // @ts-ignore
            delete res["instance"];

            return <WorkspaceAndInstance>res;
        });

        return { rows, total };
    }

    async findWorkspaceAndInstance(id: string): Promise<WorkspaceAndInstance | undefined> {
        const workspaceRepo = await this.getWorkspaceRepo();
        const workspace = await workspaceRepo.findOne(id);
        if (!workspace) {
            return;
        }

        const instance = await this.findCurrentInstance(id);
        if (!instance) {
            return;
        }

        const res = {
            ...workspace,
            ...instance,
            workspaceId: workspace.id,
            instanceId: instance.id,
            workspaceCreationTime: workspace.creationTime,
            instanceCreationTime: instance.creationTime,
            phase: instance.status.phase,
        };
        // @ts-ignore
        delete res["id"];
        // @ts-ignore
        delete res["creationTime"];

        return <WorkspaceAndInstance>res;
    }

    async findInstancesByPhase(phases: string[]): Promise<WorkspaceInstance[]> {
        if (phases.length < 0) {
            throw new Error("At least one phase must be provided");
        }

        const repo = await this.getWorkspaceInstanceRepo();
        // uses index: ind_phasePersisted
        const qb = repo
            .createQueryBuilder("wsi")
            .where("wsi.deleted != TRUE")
            .andWhere("wsi.phasePersisted IN (:phases)", { phases });
        return qb.getMany();
    }

    /**
     * Finds prebuilt workspaces by organization with optional filtering and pagination.
     * @param organizationId The ID of the organization.
     * @param pagination Pagination per page size and result offset.
     * @param filter Filters for the search.
     * @param sort Sort field and direction
     * @returns A promise that resolves to an array of PrebuiltWorkspace objects.
     */
    async findPrebuiltWorkspacesByOrganization(
        organizationId: string,
        pagination: {
            offset: number;
            limit: number;
        },
        filter: {
            configuration?: {
                id: string;
                branch?: string;
            };
            state?: "succeeded" | "failed" | "unfinished";
            searchTerm?: string;
        },
        sort: {
            field: string;
            order: "ASC" | "DESC";
        },
    ): Promise<PrebuiltWorkspaceWithWorkspace[]> {
        const repo = await this.getPrebuiltWorkspaceRepo();
        const query = repo
            .createQueryBuilder("pws")
            .innerJoinAndMapOne(
                "pws.workspace",
                DBWorkspace,
                "ws",
                "pws.buildWorkspaceId = ws.id AND ws.organizationId = :organizationId",
                { organizationId },
            )
            .innerJoinAndMapOne("pws.project", DBProject, "project", "pws.projectId = project.id")
            .where("project.markedDeleted = false")
            .andWhere("project.id IS NOT NULL")
            .andWhere("ws.contentDeletedTime = ''")
            .skip(pagination.offset)
            .take(pagination.limit)
            .orderBy("pws.creationTime", sort.order); // todo: take sort field into account

        if (filter.state) {
            const { state } = filter;
            // translating API state to DB state
            switch (state) {
                case "failed":
                    query.andWhere(
                        new Brackets((qb) => {
                            const failedStates = ["failed", "aborted", "timeout"];
                            qb.andWhere("pws.state IN (:...failedStates)", { failedStates }).orWhere(
                                new Brackets((qbInner) => {
                                    qbInner
                                        .where("pws.state = :availableState", { availableState: "available" })
                                        .andWhere("pws.error IS NOT NULL AND pws.error <> ''");
                                }),
                            );
                        }),
                    );
                    break;
                case "succeeded":
                    query.andWhere(
                        new Brackets((qb) => {
                            qb.where("pws.state = :state", { state: "available" }).andWhere(
                                new Brackets((qbInner) => {
                                    qbInner.where("pws.error IS NULL").orWhere("pws.error = ''");
                                }),
                            );
                        }),
                    );
                    break;
                case "unfinished":
                    query.andWhere("pws.state IN (:...states)", { states: ["queued", "building"] });
                    break;
            }
        }

        if (filter.configuration?.id) {
            query.andWhere("pws.projectId = :projectId", { projectId: filter.configuration.id });
            if (filter.configuration.branch) {
                query.andWhere("pws.branch = :branch", { branch: filter.configuration.branch });
            }
        }

        const normalizedSearchTerm = filter.searchTerm?.trim();
        if (normalizedSearchTerm) {
            query.andWhere(
                new Brackets((qb) => {
                    qb.where("project.cloneUrl LIKE :searchTerm", {
                        searchTerm: `%${normalizedSearchTerm}%`,
                    }).orWhere("project.name LIKE :searchTerm", { searchTerm: `%${normalizedSearchTerm}%` });
                }),
            );
        }

        return (await query.getMany()) as PrebuiltWorkspaceWithWorkspace[];
    }

    async findPrebuiltWorkspaceById(id: string): Promise<PrebuiltWorkspace | undefined> {
        const repo = await this.getPrebuiltWorkspaceRepo();

        const query = repo
            .createQueryBuilder("pws")
            .orderBy("pws.creationTime", "DESC")
            .innerJoinAndMapOne("pws.workspace", DBWorkspace, "ws", "pws.buildWorkspaceId = ws.id")
            .andWhere("pws.id = :id", { id })
            .andWhere("ws.contentDeletedTime = ''");

        return query.getOne();
    }

    async storePrebuildInfo(prebuildInfo: PrebuildInfo): Promise<void> {
        const repo = await this.getPrebuildInfoRepo();
        await repo.save({
            prebuildId: prebuildInfo.id,
            info: prebuildInfo,
        });
    }

    async findPrebuildInfos(prebuildIds: string[]): Promise<PrebuildInfo[]> {
        const repo = await this.getPrebuildInfoRepo();

        const query = repo.createQueryBuilder("pi");

        const filteredIds = prebuildIds.filter((id) => !!id);
        if (filteredIds.length === 0) {
            return [];
        }
        query.andWhere(`pi.prebuildId in (${filteredIds.map((id) => `'${id}'`).join(", ")})`);

        const res = await query.getMany();
        return res.map((r) => r.info);
    }
}

type InstanceJoinResult = DBWorkspace & { instance: WorkspaceInstance };
