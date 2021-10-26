/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { Repository, EntityManager, DeepPartial, UpdateQueryBuilder, Brackets } from "typeorm";
import { MaybeWorkspace, MaybeWorkspaceInstance, WorkspaceDB, FindWorkspacesOptions, PrebuiltUpdatableAndWorkspace, WorkspaceInstanceSessionWithWorkspace, PrebuildWithWorkspace, WorkspaceAndOwner, WorkspacePortsAuthData, WorkspaceOwnerAndSoftDeleted } from "../workspace-db";
import { Workspace, WorkspaceInstance, WorkspaceInfo, WorkspaceInstanceUser, WhitelistedRepository, Snapshot, LayoutData, PrebuiltWorkspace, RunningWorkspaceInfo, PrebuiltWorkspaceUpdatable, WorkspaceAndInstance, WorkspaceType, PrebuildInfo, AdminGetWorkspacesQuery } from "@gitpod/gitpod-protocol";
import { TypeORM } from "./typeorm";
import { DBWorkspace } from "./entity/db-workspace";
import { DBWorkspaceInstance } from "./entity/db-workspace-instance";
import { DBLayoutData } from "./entity/db-layout-data";
import { DBSnapshot } from "./entity/db-snapshot";
import { DBWorkspaceInstanceUser } from "./entity/db-workspace-instance-user";
import { DBRepositoryWhiteList } from "./entity/db-repository-whitelist";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { DBPrebuiltWorkspace } from "./entity/db-prebuilt-workspace";
import { DBPrebuiltWorkspaceUpdatable } from "./entity/db-prebuilt-workspace-updatable";
import { BUILTIN_WORKSPACE_PROBE_USER_ID } from "../user-db";
import { DBPrebuildInfo } from "./entity/db-prebuild-info-entry";

type RawTo<T> = (instance: WorkspaceInstance, ws: Workspace) => T;
interface OrderBy {
    fqField: string;
    order: 'ASC' | 'DESC';
}

@injectable()
export abstract class AbstractTypeORMWorkspaceDBImpl implements WorkspaceDB {

    protected abstract getManager(): Promise<EntityManager>;

    protected async getWorkspaceRepo(): Promise<Repository<DBWorkspace>> {
        return await (await this.getManager()).getRepository<DBWorkspace>(DBWorkspace);
    }

    protected async getWorkspaceInstanceRepo(): Promise<Repository<DBWorkspaceInstance>> {
        return await (await this.getManager()).getRepository<DBWorkspaceInstance>(DBWorkspaceInstance);
    }

    protected async getWorkspaceInstanceUserRepo(): Promise<Repository<DBWorkspaceInstanceUser>> {
        return await (await this.getManager()).getRepository<DBWorkspaceInstanceUser>(DBWorkspaceInstanceUser);
    }

    protected async getRepositoryWhitelist(): Promise<Repository<DBRepositoryWhiteList>> {
        return await (await this.getManager()).getRepository<DBRepositoryWhiteList>(DBRepositoryWhiteList);
    }

    protected async getSnapshotRepo(): Promise<Repository<DBSnapshot>> {
        return await (await this.getManager()).getRepository<DBSnapshot>(DBSnapshot);
    }

    protected async getPrebuiltWorkspaceRepo(): Promise<Repository<DBPrebuiltWorkspace>> {
        return await (await this.getManager()).getRepository<DBPrebuiltWorkspace>(DBPrebuiltWorkspace);
    }

    protected async getPrebuildInfoRepo(): Promise<Repository<DBPrebuildInfo>> {
        return await (await this.getManager()).getRepository<DBPrebuildInfo>(DBPrebuildInfo);
    }

    protected async getPrebuiltWorkspaceUpdatableRepo(): Promise<Repository<DBPrebuiltWorkspaceUpdatable>> {
        return await (await this.getManager()).getRepository<DBPrebuiltWorkspaceUpdatable>(DBPrebuiltWorkspaceUpdatable);
    }

    protected async getLayoutDataRepo(): Promise<Repository<DBLayoutData>> {
        return await (await this.getManager()).getRepository<DBLayoutData>(DBLayoutData);
    }

    public async connect(maxTries: number = 3, timeout: number = 2000): Promise<void> {
        let tries = 1;
        while (tries <= maxTries) {
            try {
                await this.getManager();
                return;
            } catch (err) {
                log.error(`DB connection error (attempt ${tries} of ${maxTries})`, err);
                await new Promise(resolve => setTimeout(resolve, timeout));
            }
            tries++;
        }
        throw new Error("Could not establish connection to database!");
    }

    public async transaction<T>(code: (db: WorkspaceDB) => Promise<T>): Promise<T> {
        return code(this);
    }

    async storeInstance(instance: WorkspaceInstance): Promise<WorkspaceInstance> {
        const inst = await this.internalStoreInstance(instance);
        return inst;
    }

    public async findRunningInstance(workspaceId: string): Promise<MaybeWorkspaceInstance> {
        const instance = await this.findCurrentInstance(workspaceId)
        if (instance && instance.status.phase !== 'stopped') {
            return instance;
        }
        return undefined;
    }

    public async store(workspace: Workspace) {
        const workspaceRepo = await this.getWorkspaceRepo();
        const dbWorkspace = workspace as DBWorkspace;
        return await workspaceRepo.save(dbWorkspace);
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
        const workspaceRepo = await this.getWorkspaceRepo();
        const maybeRawWorkspaces = await workspaceRepo.query(`SELECT ws.* FROM d_b_workspace as ws
                                LEFT OUTER JOIN d_b_workspace_instance as wsi ON wsi.workspaceId = ws.id
                                WHERE wsi.id = ?;`, [instanceId]) as object[];
        if (!maybeRawWorkspaces || maybeRawWorkspaces.length !== 1) {
            return undefined;
        }
        return this.makeWorkspace(maybeRawWorkspaces[0]);
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
            .createQueryBuilder('ws')
            // We need to put the subquery into the join condition (ON) here to be able to reference `ws.id` which is
            // not possible in a subquery on JOIN (e.g. 'LEFT JOIN (SELECT ... WHERE i.workspaceId = ws.id)')
            .leftJoinAndMapOne('ws.latestInstance', DBWorkspaceInstance, 'wsi',
                `wsi.id = (SELECT i.id FROM d_b_workspace_instance AS i WHERE i.workspaceId = ws.id ORDER BY i.creationTime DESC LIMIT 1)`
            )
            .leftJoin((qb) => {
                return qb.select('workspaceId')
                    .from(DBWorkspaceInstance, 'i2')
                    .where('i2.phasePersisted = "running"');
            }, 'wsiRunning', 'ws.id = wsiRunning.workspaceId')
            .where('ws.ownerId = :userId', { userId: options.userId })
            .andWhere('ws.softDeleted IS NULL')
            .andWhere('ws.deleted != TRUE')
            .orderBy('wsiRunning.workspaceId', 'DESC')
            .addOrderBy('GREATEST(ws.creationTime, wsi.creationTime, wsi.startedTime, wsi.stoppedTime)', 'DESC')
            .limit(options.limit || 10);
        if (options.searchString) {
            qb.andWhere("ws.description LIKE :searchString", {searchString: `%${options.searchString}%`});
        }
        if (!options.includeHeadless) {
            qb.andWhere("ws.type = 'regular'");
        }
        if (options.pinnedOnly) {
            qb.andWhere("ws.pinned = true");
        }
        const projectIds = typeof options.projectId === 'string' ? [options.projectId] : options.projectId;
        if (Array.isArray(projectIds)) {
            if (projectIds.length === 0 && !options.includeWithoutProject) {
                // user passed an empty array of projectids and also is not interested in unassigned workspaces -> no results
                return [];
            }
            qb.andWhere(new Brackets(qb => {
                if (projectIds.length > 0) {
                    qb.where('ws.projectId IN (:pids)', { pids: projectIds });
                    if (options.includeWithoutProject) {
                        qb.orWhere("ws.projectId IS NULL");
                    }
                } else if (options.includeWithoutProject) {
                    qb.where("ws.projectId IS NULL");
                }
            }));
        }
        const rawResults = await qb.getMany() as any as (Workspace & { latestInstance?: WorkspaceInstance })[]; // see leftJoinAndMapOne above
        return rawResults.map(r => {
            const workspace = { ...r };
            delete workspace.latestInstance;
            return {
                workspace,
                latestInstance: r.latestInstance
            };
        });
    }

    private makeWorkspace(raw: any): DBWorkspace | undefined {
        if (!raw) return undefined;
        return {
            ...raw,
            config: JSON.parse(raw.config),
            context: JSON.parse(raw.context),
            pinned: raw.pinned && JSON.parse(raw.pinned) || undefined
        }
    }

    protected async augmentWithCurrentInstance(workspaces: Workspace[]): Promise<WorkspaceInfo[]> {
        const result: WorkspaceInfo[] = [];
        for (const workspace of workspaces) {
            const latestInstance = await this.findCurrentInstance(workspace.id);
            result.push({
                workspace,
                latestInstance
            });
        }
        return result;
    }

    public async updateLastHeartbeat(instanceId: string, userId: string, newHeartbeat: Date, wasClosed?: boolean): Promise<void> {
        const query = "INSERT INTO d_b_workspace_instance_user(instanceId, userId, lastSeen) VALUES (?, ?, timestamp ?) ON DUPLICATE KEY UPDATE lastSeen = timestamp ?, wasClosed = ?"
        const lastSeen = this.toTimestampString(newHeartbeat);
        const workspaceInstanceUserRepo = await this.getWorkspaceInstanceUserRepo();
        workspaceInstanceUserRepo.query(query, [instanceId, userId, lastSeen, lastSeen, wasClosed || false]);
    }

    protected toTimestampString(date: Date) {
        return date.toISOString().split('.')[0];
    }

    public async getLastOwnerHeartbeatFor(instance: WorkspaceInstance): Promise<{ lastSeen: Date, wasClosed?: boolean } | undefined> {
        const query = 'SELECT `DBWorkspaceInstanceUser`.`lastSeen` AS `lastSeen`,`DBWorkspaceInstanceUser`.`wasClosed` AS `wasClosed` FROM `d_b_workspace_instance_user` `DBWorkspaceInstanceUser` WHERE `DBWorkspaceInstanceUser`.`instanceId`=? AND `DBWorkspaceInstanceUser`.`userId`=(SELECT `ws`.`ownerId` AS `ws_ownerId` FROM `d_b_workspace` `ws` WHERE `ws`.`id` = ? LIMIT 1)'
        const workspaceInstanceUserRepo = await this.getWorkspaceInstanceUserRepo();
        const result = await workspaceInstanceUserRepo.query(query, [instance.id, instance.workspaceId]);

        if (result && result.length > 0 && result[0].lastSeen) {
            return {
                lastSeen: new Date(result[0].lastSeen),
                wasClosed: Boolean(result[0].wasClosed)
            }
        }
        return undefined;
    }

    public async getWorkspaceUsers(workspaceId: string, minLastSeen: number): Promise<WorkspaceInstanceUser[]> {
        const repo = await this.getWorkspaceInstanceUserRepo();
        const minLastSeenString = this.toTimestampString(new Date(new Date().getTime() - minLastSeen));
        const query = "SELECT wsiu.instanceId as instanceId, wsiu.userId as userId, wsiu.lastSeen as lastSeen, user.avatarUrl as avatarUrl, user.name as name FROM d_b_workspace_instance_user wsiu, d_b_user user, d_b_workspace_instance wsi WHERE user.id = wsiu.userId AND wsi.id = wsiu.instanceId AND wsi.workspaceId = ? AND wsiu.lastSeen > (timestamp ?)";
        return repo.query(query, [workspaceId, minLastSeenString]);
    }

    public async internalStoreInstance(instance: WorkspaceInstance): Promise<WorkspaceInstance> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        const dbInstance = instance as DBWorkspaceInstance;
        dbInstance.phasePersisted = dbInstance.status.phase;
        return await workspaceInstanceRepo.save(dbInstance);
    }

    public async updateInstancePartial(instanceId: string, partial: DeepPartial<WorkspaceInstance>): Promise<WorkspaceInstance> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        if (!!partial.status) {
            (partial as any).phasePersisted = partial.status.phase;
        }
        await workspaceInstanceRepo.update(instanceId, partial);
        return (await this.findInstanceById(instanceId))!;
    }

    protected async queryUpdateInstanceConditional(instanceId: string, partial: DeepPartial<WorkspaceInstance>): Promise<UpdateQueryBuilder<WorkspaceInstance>> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        const qb = workspaceInstanceRepo.createQueryBuilder('wsi').update();
        return qb.set(partial).where('wsi.id = :instanceId', { instanceId })
    }

    public async findInstanceById(workspaceInstanceId: string): Promise<MaybeWorkspaceInstance> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        return workspaceInstanceRepo.findOne(workspaceInstanceId);
    }

    public async findInstances(workspaceId: string): Promise<WorkspaceInstance[]> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        const qBuilder = workspaceInstanceRepo.createQueryBuilder('wsi')
            .where('wsi.workspaceId = :workspaceId', { workspaceId })
            .orderBy('creationTime', 'ASC');
        return qBuilder.getMany();
    }

    public async findWorkspacesByUser(userId: string): Promise<Workspace[]> {
        const workspaceRepo = await this.getWorkspaceRepo();
        return workspaceRepo.find({ ownerId: userId });
    }

    public async findCurrentInstance(workspaceId: string): Promise<MaybeWorkspaceInstance> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        workspaceInstanceRepo.findOne(workspaceId, {})
        const qb = await workspaceInstanceRepo.createQueryBuilder('wsi')
            .where(`wsi.workspaceId = :workspaceId`, { workspaceId })
            .orderBy('creationTime', 'DESC')
            .limit(1);
        return qb.getOne();
    }

    public async findAllWorkspaceInstances(
        offset: number,
        limit: number,
        orderBy: keyof WorkspaceInstance,
        orderDir: "ASC" | "DESC",
        ownerId?: string,
        minCreationTime?: Date,
        maxCreationTime?: Date,
        onlyRunning?: boolean,
        type?: WorkspaceType
    ): Promise<{ total: number, rows: WorkspaceInstance[] }> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        const queryBuilder = workspaceInstanceRepo.createQueryBuilder("wsi")
            .leftJoinAndMapOne("wsi.workspace", DBWorkspace, "ws", "wsi.workspaceId = ws.id")
            .skip(offset)
            .take(limit)
            .orderBy("wsi." + orderBy, orderDir)
            .where("ws.type = :type", { type: type ? type.toString() : "regular" }); // only regular workspaces by default
        if (ownerId) {
            queryBuilder.andWhere("wsi.ownerId = :ownerId", { ownerId });
        }
        if (minCreationTime) {
            queryBuilder.andWhere("wsi.creationTime >= :minCreationTime", { minCreationTime: minCreationTime.toISOString() });
        }
        if (maxCreationTime) {
            queryBuilder.andWhere("wsi.creationTime < :maxCreationTime", { maxCreationTime: maxCreationTime.toISOString() });
        }
        if (onlyRunning) {
            queryBuilder.andWhere("wsi.phasePersisted != 'stopped'").andWhere("wsi.deleted != TRUE");
        }
        const [rows, total] = await queryBuilder.getManyAndCount();
        return { total, rows };
    }

    public async findRegularRunningInstances(userId?: string): Promise<WorkspaceInstance[]> {
        const infos = await this.findRunningInstancesWithWorkspaces(undefined, userId);
        return infos.filter(
            info => info.workspace.type === 'regular'
        ).map(wsinfo => wsinfo.latestInstance);
    }

    public async findRunningInstancesWithWorkspaces(installation?: string, userId?: string, includeStopping: boolean = false): Promise<RunningWorkspaceInfo[]> {
        const params: any = {};
        const conditions = ["wsi.phasePersisted != 'stopped'", "wsi.deleted != TRUE"];
        if (!includeStopping) {
            // This excludes instances in a 'stopping' phase
            conditions.push("wsi.phasePersisted != 'stopping'");
        }
        if (installation) {
            params.region = installation;
            conditions.push("wsi.region = :region");
        }
        const joinParams: any = {};
        const joinConditions = [];
        if (userId) {
            joinParams.userId = userId;
            joinConditions.push("ws.ownerId = :userId");
        }
        return this.doJoinInstanceWithWorkspace<RunningWorkspaceInfo>(conditions, params, joinConditions, joinParams, (wsi, ws) => {
            return { workspace: ws, latestInstance: wsi };
        })
    }

    public async findWorkspacePortsAuthDataById(workspaceId: string): Promise<WorkspacePortsAuthData | undefined> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        const results = await workspaceInstanceRepo.query(`
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
            `, [workspaceId]) as any[];
        if (results.length < 1) {
            return undefined
        }

        const res = results[0];
        return {
            workspace: {
                id: res.ws_id,
                ownerId: res.ws_ownerId,
                shareable: res.ws_shareable
            },
            instance: {
                id: res.wsi_id,
                region: res.wsi_region
            }
        };
    }

    public async findSessionsInPeriod(userId: string, periodStart: string, periodEnd: string): Promise<WorkspaceInstanceSessionWithWorkspace[]> {
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        // The query basically selects all workspace instances for the given owner, whose startDate is within the period, and which are either:
        //  - not stopped yet, or
        //  - is stopped or stopping.
        const sessions = await workspaceInstanceRepo.query(`
                SELECT wsi.id AS wsi_id,
                        wsi.startedTime AS wsi_startedTime,
                        wsi.stoppedTime AS wsi_stoppedTime,
                        wsi.stoppingTime AS wsi_stoppingTime,
                        ws.id AS ws_id,
                        ws.type AS ws_type,
                        ws.contextURL AS ws_contextURL,
                        ws.context AS ws_context
                    FROM d_b_workspace_instance AS wsi
                    INNER JOIN d_b_workspace AS ws ON wsi.workspaceId = ws.id
                    WHERE ws.ownerId = ?
                        AND wsi.startedTime < ?
                        AND (wsi.stoppedTime IS NULL OR wsi.stoppedTime = '' OR wsi.stoppedTime >= ? OR wsi.stoppingTime >= ?)
                    ORDER BY wsi.creationTime ASC;
            `, [userId, periodEnd, periodStart, periodStart]);

        const resultSessions: WorkspaceInstanceSessionWithWorkspace[] = [];
        for (const session of sessions) {
            resultSessions.push({
                workspace: {
                    id: session.ws_id,
                    context: JSON.parse(session.ws_context),
                    contextURL: session.ws_contextURL,
                    type: session.ws_type
                },
                instance: {
                    id: session.wsi_id,
                    startedTime: !session.wsi_startedTime ? undefined : session.wsi_startedTime,    // Copy the TypeORM behavior according to column config
                    stoppedTime: !session.wsi_stoppedTime ? undefined : session.wsi_stoppedTime,    // Copy the TypeORM behavior according to column config
                    stoppingTime: !session.wsi_stoppingTime ? undefined : session.wsi_stoppingTime  // Copy the TypeORM behavior according to column config
                }
            });
        }
        return resultSessions;
    }

    public async findWorkspacesForGarbageCollection(minAgeInDays: number, limit: number): Promise<WorkspaceAndOwner[]> {
        const workspaceRepo = await this.getWorkspaceRepo();
        const dbResults = await workspaceRepo.query(`
                SELECT ws.id AS id,
                       ws.ownerId AS ownerId
                    FROM d_b_workspace AS ws
                    LEFT OUTER JOIN d_b_workspace_instance AS wsi ON ws.id=wsi.workspaceid
                    WHERE	ws.deleted = 0
                        AND ws.type='regular'
                        AND ws.softDeleted IS NULL
                        AND ws.pinned = 0
                        AND ws.creationTime < NOW() - INTERVAL ? DAY
                    GROUP BY ws.id, ws.ownerId
                    HAVING MAX(GREATEST(wsi.creationTime, wsi.startedTime, wsi.stoppedTime)) < NOW() - INTERVAL ? DAY OR MAX(wsi.creationTime) IS NULL
                    LIMIT ?;
            `, [minAgeInDays, minAgeInDays, limit]);

        return dbResults as WorkspaceAndOwner[];
    }

    public async findWorkspacesForContentDeletion(minSoftDeletedTimeInDays: number, limit: number): Promise<WorkspaceOwnerAndSoftDeleted[]> {
        const workspaceRepo = await this.getWorkspaceRepo();
        const dbResults = await workspaceRepo.query(`
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
            `, [minSoftDeletedTimeInDays, BUILTIN_WORKSPACE_PROBE_USER_ID, limit]);

        return dbResults as WorkspaceOwnerAndSoftDeleted[];
    }

    public async findPrebuiltWorkspacesForGC(daysUnused: number, limit: number): Promise<WorkspaceAndOwner[]> {
        const workspaceRepo = await this.getWorkspaceRepo();
        const dbResults = await workspaceRepo.query(`
                SELECT ws.id AS id,
                    ws.ownerId AS ownerId
                FROM d_b_workspace AS ws,
                    d_b_prebuilt_workspace AS pb
                LEFT OUTER JOIN d_b_workspace AS usages ON usages.basedOnPrebuildId = pb.id
                WHERE
                        pb.buildworkspaceId = ws.id
                    AND ws.contentDeletedTime = ''
                    AND ws.pinned = 0
                    AND ws.creationTime < NOW() - INTERVAL ? DAY
                GROUP BY ws.id, ws.ownerId
                HAVING
                    max(usages.creationTime) IS NULL or max(usages.creationTime) < NOW() - INTERVAL ? DAY
                LIMIT ?;
            `, [daysUnused, daysUnused, limit]);
        return dbResults as WorkspaceAndOwner[];
    }

    protected async doJoinInstanceWithWorkspace<T>(conditions: string[], conditionParams: {}, joinConditions: string[], joinConditionParams: {}, map: RawTo<T>, orderBy?: OrderBy): Promise<T[]> {
        type InstanceJoinResult = DBWorkspaceInstance & { workspace: Workspace };

        joinConditions = ['wsi.workspaceId = ws.id', ...joinConditions];   // Basic JOIN condition
        const workspaceInstanceRepo = await this.getWorkspaceInstanceRepo();
        let qb = workspaceInstanceRepo
            .createQueryBuilder('wsi')
            .where(conditions.join(' AND '), conditionParams)
            .innerJoinAndMapOne('wsi.workspace', DBWorkspace, 'ws', joinConditions.join(' AND '), joinConditionParams);
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

    public async isWhitelisted(repositoryUrl: string): Promise<boolean> {
        const whitelist = await this.getRepositoryWhitelist();
        const repoCount = await whitelist.createQueryBuilder('rwl')
            .select('1')
            .where('rwl.url = :url', { 'url': repositoryUrl })
            .getCount();
        return repoCount > 0;
    }

    public async getFeaturedRepositories(): Promise<Partial<WhitelistedRepository>[]> {
        const whitelist = await this.getRepositoryWhitelist();
        const allRepos = await whitelist.createQueryBuilder('rwl')
            .where('rwl.priority >= :minPrio', { minPrio: DBRepositoryWhiteList.MIN_FEATURED_REPOSITORY_PRIO })
            .orderBy('priority', 'DESC')
            .getMany();
        return allRepos.map(repo => {
            return {
                url: repo.url,
                description: repo.description
            }
        });
    }

    public async findSnapshotById(snapshotId: string): Promise<Snapshot | undefined> {
        const snapshots = await this.getSnapshotRepo();
        return snapshots.findOne(snapshotId);
    }

    public async storeSnapshot(snapshot: Snapshot): Promise<Snapshot> {
        const snapshots = await this.getSnapshotRepo();
        const dbSnapshot = snapshot as DBSnapshot;
        return await snapshots.save(dbSnapshot);
    }

    public async findSnapshotsByWorkspaceId(workspaceId: string): Promise<Snapshot[]> {
        const snapshots = await this.getSnapshotRepo();
        return snapshots.find({where: {originalWorkspaceId: workspaceId}});
    }

    public async storePrebuiltWorkspace(pws: PrebuiltWorkspace): Promise<PrebuiltWorkspace> {
        const repo = await this.getPrebuiltWorkspaceRepo();
        if (pws.error && pws.error.length > 255) {
            pws.error = pws.error.substring(0, 251) + " ..."
        }
        return await repo.save(pws as DBPrebuiltWorkspace);
    }

    // Find the (last triggered) prebuild for a given commit
    public async findPrebuiltWorkspaceByCommit(cloneURL: string, commit: string): Promise<PrebuiltWorkspace | undefined> {
        if (!commit || !cloneURL) {
            return undefined;
        }
        const repo = await this.getPrebuiltWorkspaceRepo();
        return await repo.createQueryBuilder('pws')
            .where('pws.cloneURL = :cloneURL AND pws.commit LIKE :commit', { cloneURL, commit: commit+'%' })
            .orderBy('pws.creationTime', 'DESC')
            .innerJoinAndMapOne('pws.workspace', DBWorkspace, 'ws', "pws.buildWorkspaceId = ws.id and ws.contentDeletedTime = ''")
            .getOne();
    }

    public async findPrebuildByWorkspaceID(wsid: string): Promise<PrebuiltWorkspace | undefined> {
        const repo = await this.getPrebuiltWorkspaceRepo();
        return await repo.createQueryBuilder('pws')
            .where('pws.buildWorkspaceId = :wsid', { wsid })
            .getOne();
    }
    public async findPrebuildByID(pwsid: string): Promise<PrebuiltWorkspace | undefined> {
        const repo = await this.getPrebuiltWorkspaceRepo();
        return await repo.findOne(pwsid);
    }
    public async countRunningPrebuilds(cloneURL: string): Promise<number> {
        const repo = await this.getPrebuiltWorkspaceRepo();
        return await repo.createQueryBuilder('pws')
            .where('pws.cloneURL = :cloneURL AND state = "building"', { cloneURL })
            .getCount();
    }

    public async findPrebuildsWithWorkpace(cloneURL: string): Promise<PrebuildWithWorkspace[]> {
        const repo = await this.getPrebuiltWorkspaceRepo();

        let query = repo.createQueryBuilder('pws');
        query = query.where('pws.cloneURL = :cloneURL', { cloneURL })
        query = query.orderBy('pws.creationTime', 'ASC');
        query = query.innerJoinAndMapOne('pws.workspace', DBWorkspace, 'ws', 'pws.buildWorkspaceId = ws.id');

        const res = await query.getMany();
        return res.map(r => {
            const withWorkspace: PrebuiltWorkspace & { workspace: Workspace } = r as any;
            return {
                prebuild: r,
                workspace: withWorkspace.workspace,
            }
        });
    }

    public async findQueuedPrebuilds(cloneURL?: string): Promise<PrebuildWithWorkspace[]> {
        const repo = await this.getPrebuiltWorkspaceRepo();

        let query = await repo.createQueryBuilder('pws');
        query = query.where('state = "queued"');
        if (cloneURL) {
            query = query.andWhere('pws.cloneURL = :cloneURL', { cloneURL })
        }
        query = query.orderBy('pws.creationTime', 'ASC');
        query = query.innerJoinAndMapOne('pws.workspace', DBWorkspace, 'ws', 'pws.buildWorkspaceId = ws.id');

        const res = await query.getMany();
        return res.map(r => {
            const withWorkspace: PrebuiltWorkspace & { workspace: Workspace } = r as any;
            return {
                prebuild: r,
                workspace: withWorkspace.workspace,
            }
        });
    }
    public async attachUpdatableToPrebuild(pwsid: string, update: PrebuiltWorkspaceUpdatable): Promise<void> {
        const repo = await this.getPrebuiltWorkspaceUpdatableRepo();
        await repo.save(update);
    }
    public async findUpdatablesForPrebuild(pwsid: string): Promise<PrebuiltWorkspaceUpdatable[]> {
        const repo = await this.getPrebuiltWorkspaceUpdatableRepo();
        return await repo.createQueryBuilder('pwsu')
            .where('pwsu.prebuiltWorkspaceId = :pwsid', { pwsid })
            .getMany();
    }
    public async markUpdatableResolved(updatableId: string): Promise<void> {
        const repo = await this.getPrebuiltWorkspaceUpdatableRepo();
        await repo.update(updatableId, { isResolved: true });
    }
    public async getUnresolvedUpdatables(): Promise<PrebuiltUpdatableAndWorkspace[]> {
        const pwsuRepo = await this.getPrebuiltWorkspaceUpdatableRepo();

        // select * from d_b_prebuilt_workspace_updatable as pwsu left join d_b_prebuilt_workspace pws ON pws.id = pwsu.prebuiltWorkspaceId left join d_b_workspace ws on pws.buildWorkspaceId = ws.id left join d_b_workspace_instance wsi on ws.id = wsi.workspaceId where pwsu.isResolved = 0
        return await pwsuRepo.createQueryBuilder("pwsu")
            .innerJoinAndMapOne('pwsu.prebuild', DBPrebuiltWorkspace, 'pws', 'pwsu.prebuiltWorkspaceId = pws.id')
            .innerJoinAndMapOne('pwsu.workspace', DBWorkspace, 'ws', 'pws.buildWorkspaceId = ws.id')
            .innerJoinAndMapOne('pwsu.instance', DBWorkspaceInstance, 'wsi', 'ws.id = wsi.workspaceId')
            .where('pwsu.isResolved = 0')
            .getMany() as any;
    }

    public async findLayoutDataByWorkspaceId(workspaceId: string): Promise<LayoutData | undefined> {
        const layoutDataRepo = await this.getLayoutDataRepo();
        return layoutDataRepo.findOne(workspaceId);
    }

    public async storeLayoutData(layoutData: LayoutData): Promise<LayoutData> {
        const layoutDataRepo = await this.getLayoutDataRepo();
        const dbLayoutData = layoutData as DBLayoutData;
        return await layoutDataRepo.save(dbLayoutData);
    }

    /**
     * This *hard deletes* the workspace entry and all corresponding workspace-instances, by triggering a db-sync mechanism that purges it from the DB.
     * Note: when this function returns that doesn't mean that the entries are actually gone yet, that might still take a short while until db-sync comes
     *       around to deleting them.
     */
    public async hardDeleteWorkspace(workspaceId: string): Promise<void> {
        await (await this.getWorkspaceRepo()).update(workspaceId, { deleted: true });
        await (await this.getWorkspaceInstanceRepo()).update({ workspaceId }, { deleted: true });
    }

    public async findAllWorkspaces(
        offset: number,
        limit: number,
        orderBy: keyof Workspace,
        orderDir: "ASC" | "DESC",
        ownerId?: string,
        searchTerm?: string,
        minCreationTime?: Date,
        maxCreationTime?: Date,
        type?: WorkspaceType
    ): Promise<{ total: number, rows: Workspace[] }> {
        const workspaceRepo = await this.getWorkspaceRepo();
        const queryBuilder = workspaceRepo.createQueryBuilder("ws")
            .skip(offset)
            .take(limit)
            .orderBy(orderBy, orderDir)
            .where("ws.type = :type", { type: type ? type.toString() : "regular" }); // only regular workspaces by default
        if (ownerId) {
            queryBuilder.andWhere("ownerId = :ownerId", { ownerId });
        }
        if (searchTerm) {
            queryBuilder.andWhere("(contextURL LIKE :searchTerm OR description LIKE :searchTerm)", { searchTerm });
        }
        if (minCreationTime) {
            queryBuilder.andWhere("creationTime >= :minCreationTime", { minCreationTime: minCreationTime.toISOString() });
        }
        if (maxCreationTime) {
            queryBuilder.andWhere("creationTime < :maxCreationTime", { maxCreationTime: maxCreationTime.toISOString() });
        }
        const [rows, total] = await queryBuilder.getManyAndCount();
        return { total, rows };
    }



    public async findAllWorkspaceAndInstances(offset: number, limit: number, orderBy: keyof WorkspaceAndInstance, orderDir: "ASC" | "DESC", query?: AdminGetWorkspacesQuery, searchTerm?: string): Promise<{ total: number, rows: WorkspaceAndInstance[] }> {
        let whereConditions = [];
        let whereConditionParams: any = {};
        let instanceIdQuery: boolean = false;

        if (query) {
            // from most to least specific so we don't generalize accidentally
            if (query.instanceIdOrWorkspaceId) {
                whereConditions.push("(wsi.id = :instanceId OR ws.id = :workspaceId)");
                whereConditionParams.instanceId = query.instanceIdOrWorkspaceId;
                whereConditionParams.workspaceId = query.instanceIdOrWorkspaceId;
            } else if (query.instanceId) {
                // in addition to adding "instanceId" to the "WHERE" clause like for the other workspace-guided queries,
                // we modify the JOIN condition below to a) select the correct instance and b) make the query faster
                instanceIdQuery = true;

                whereConditions.push("wsi.id = :instanceId");
                whereConditionParams.instanceId = query.instanceId;
            } else if (query.workspaceId) {
                whereConditions.push("ws.id = :workspaceId");
                whereConditionParams.workspaceId = query.workspaceId;
            } else if (query.ownerId) {
                // If an owner id is provided only search for workspaces belonging to that user.
                whereConditions.push("ws.ownerId = :ownerId");
                whereConditionParams.ownerId = query.ownerId;
            }
        }

        if (searchTerm) {
            // If a search term is provided perform a wildcard search in the context url or exact match on the workspace id (aka workspace name) or the instance id.
            whereConditions.push(`ws.contextURL LIKE '%${searchTerm}%'`);
        }

        let orderField: string = orderBy;
        switch (orderField) {
            case "workspaceId": orderField = "ws.id"; break;
            case "instanceId": orderField = "wsi.id"; break;
            case "contextURL": orderField = "ws.contextURL"; break;
            case "workspaceCreationTime": orderField = "ws.creationTime"; break;
            case "instanceCreationTime": orderField = "wsi.creationTime"; break;
            case "phase": orderField = "wsi.status->>phase"; break;
            case "ownerId": orderField = "wsi.ownerId"; break;
        }

        // We need to select the latest wsi for a workspace. It's the same problem we have in 'find' (the "/workspaces" query, see above), so we use the same approach.
        // Only twist is that we might be searching for an instance directly ('instanceIdQuery').
        const workspaceRepo = await this.getWorkspaceRepo();
        let qb = workspaceRepo
            .createQueryBuilder('ws')
            // We need to put the subquery into the join condition (ON) here to be able to reference `ws.id` which is
            // not possible in a subquery on JOIN (e.g. 'LEFT JOIN (SELECT ... WHERE i.workspaceId = ws.id)')
            .leftJoinAndMapOne('ws.instance', DBWorkspaceInstance, 'wsi',
                `${instanceIdQuery ? "wsi.workspaceId = ws.id" : "wsi.id = (SELECT i.id FROM d_b_workspace_instance AS i WHERE i.workspaceId = ws.id ORDER BY i.creationTime DESC LIMIT 1)"}`
            )
            .where(whereConditions.join(' AND '), whereConditionParams)
            .orderBy(orderField, orderDir)
            .take(limit)
            .skip(offset);

        const rawResult = (await qb.getMany()) as InstanceJoinResult[];
        const total = await qb.getCount();
        const rows = (rawResult as InstanceJoinResult[]).map(r => {
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

            return <WorkspaceAndInstance>(res);
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

        return <WorkspaceAndInstance>(res);
    }

    async findPrebuiltWorkspacesByProject(projectId: string, branch?: string, limit?: number): Promise<PrebuiltWorkspace[]> {
        const repo = await this.getPrebuiltWorkspaceRepo();

        const query = repo.createQueryBuilder('pws')
            .orderBy('pws.creationTime', 'DESC')
            .innerJoinAndMapOne('pws.workspace', DBWorkspace, 'ws', 'pws.buildWorkspaceId = ws.id')
            .andWhere('pws.projectId = :projectId', { projectId });

        if (branch) {
            query.andWhere('pws.branch = :branch', { branch });
        }
        if (limit) {
            query.limit(limit);
        }

        const res = await query.getMany();
        return res;
    }

    async findPrebuiltWorkspaceById(id: string): Promise<PrebuiltWorkspace | undefined> {
        const repo = await this.getPrebuiltWorkspaceRepo();

        const query = repo.createQueryBuilder('pws')
            .orderBy('pws.creationTime', 'DESC')
            .innerJoinAndMapOne('pws.workspace', DBWorkspace, 'ws', 'pws.buildWorkspaceId = ws.id')
            .andWhere('pws.id = :id', { id });

        return query.getOne();
    }

    async storePrebuildInfo(prebuildInfo: PrebuildInfo): Promise<void> {
        const repo = await this.getPrebuildInfoRepo();
        await repo.save({
            prebuildId: prebuildInfo.id,
            info: prebuildInfo
        });
    }

    async findPrebuildInfos(prebuildIds: string[]): Promise<PrebuildInfo[]>{
        const repo = await this.getPrebuildInfoRepo();

        const query = repo.createQueryBuilder('pi');

        const filteredIds = prebuildIds.filter(id => !!id);
        if (filteredIds.length === 0) {
            return [];
        }
        query.andWhere(`pi.prebuildId in (${ filteredIds.map(id => `'${id}'`).join(", ") })`)

        const res = await query.getMany();
        return res.map(r => r.info);
    }

}

@injectable()
export class TypeORMWorkspaceDBImpl extends AbstractTypeORMWorkspaceDBImpl {

    @inject(TypeORM) protected readonly typeorm: TypeORM;

    protected async getManager() {
        return (await this.typeorm.getConnection()).manager;
    }

    public async transaction<T>(code: (db: WorkspaceDB) => Promise<T>): Promise<T> {
        const connection = await this.typeorm.getConnection();
        return connection.transaction(manager => {
            return code(new TransactionalWorkspaceDbImpl(manager));
        });
    }
}

export class TransactionalWorkspaceDbImpl extends AbstractTypeORMWorkspaceDBImpl {

    constructor(
        protected readonly manager: EntityManager) {
        super();
    }

    protected async getManager() {
        return this.manager;
    }

    public async transaction<T>(code: (sb: WorkspaceDB) => Promise<T>): Promise<T> {
        return await code(this);
    }
}

type InstanceJoinResult = DBWorkspace & { instance: WorkspaceInstance };
