/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { SSHPublicKeyValue, UserSSHPublicKeyValue, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { UpdateSSHKeyRequest } from "@gitpod/ws-manager/lib";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import { Authorizer } from "../authorization/authorizer";

@injectable()
export class SSHKeyService {
    constructor(
        @inject(WorkspaceDB) private readonly workspaceDb: WorkspaceDB,
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(WorkspaceManagerClientProvider)
        private readonly workspaceManagerClientProvider: WorkspaceManagerClientProvider,
        @inject(Authorizer) private readonly auth: Authorizer,
    ) {}

    async hasSSHPublicKey(requestorId: string, userId: string): Promise<boolean> {
        await this.auth.checkPermissionOnUser(requestorId, "read_ssh", userId);
        return this.userDB.hasSSHPublicKey(userId);
    }

    async getSSHPublicKeys(requestorId: string, userId: string): Promise<UserSSHPublicKeyValue[]> {
        await this.auth.checkPermissionOnUser(requestorId, "read_ssh", userId);
        const list = await this.userDB.getSSHPublicKeys(userId);
        return list.map((e) => ({
            id: e.id,
            name: e.name,
            key: e.key,
            fingerprint: e.fingerprint,
            creationTime: e.creationTime,
            lastUsedTime: e.lastUsedTime,
        }));
    }

    async addSSHPublicKey(
        requestorId: string,
        userId: string,
        value: SSHPublicKeyValue,
    ): Promise<UserSSHPublicKeyValue> {
        await this.auth.checkPermissionOnUser(requestorId, "write_ssh", userId);
        const data = await this.userDB.addSSHPublicKey(userId, value);
        this.updateSSHKeysForRegularRunningInstances(userId).catch((err) => {
            log.error("Failed to update ssh keys on running instances.", err);
        });
        return {
            id: data.id,
            name: data.name,
            key: data.key,
            fingerprint: data.fingerprint,
            creationTime: data.creationTime,
            lastUsedTime: data.lastUsedTime,
        };
    }

    async deleteSSHPublicKey(requestorId: string, userId: string, id: string): Promise<void> {
        await this.auth.checkPermissionOnUser(requestorId, "write_ssh", userId);
        await this.userDB.deleteSSHPublicKey(userId, id);
        this.updateSSHKeysForRegularRunningInstances(userId).catch((err) => {
            log.error("Failed to update ssh keys on running instances.", err);
        });
    }

    private async updateSSHKeysForRegularRunningInstances(userId: string) {
        const updateSSHKeysOfInstance = async (instance: WorkspaceInstance, sshKeys: string[]) => {
            try {
                const req = new UpdateSSHKeyRequest();
                req.setId(instance.id);
                req.setKeysList(sshKeys);
                const cli = await this.workspaceManagerClientProvider.get(instance.region);
                await cli.updateSSHPublicKey({}, req);
            } catch (err) {
                const logCtx = { userId, instanceId: instance.id };
                log.error(logCtx, "Could not update ssh public key for instance", err);
            }
        };
        const sshKeys = (await this.userDB.getSSHPublicKeys(userId)).map((e) => e.key);
        const instances = await this.workspaceDb.findRegularRunningInstances(userId);
        return Promise.allSettled(instances.map((instance) => updateSSHKeysOfInstance(instance, sshKeys)));
    }
}
