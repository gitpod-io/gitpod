/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BUILTIN_INSTLLATION_ADMIN_USER_ID, UserDB } from "@gitpod/gitpod-db/lib";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { Job } from "./runner";

@injectable()
export class InstallationAdminCleanup implements Job {
    @inject(UserDB) protected readonly userDb: UserDB;

    public name = "installation-admin-cleanup";
    public frequencyMs = 5 * 60 * 1000; // every 5 minutes

    public async run(): Promise<number | undefined> {
        try {
            const installationAdmin = await this.userDb.findUserById(BUILTIN_INSTLLATION_ADMIN_USER_ID);
            if (!installationAdmin) {
                return;
            }

            let cleanupRequired = false;
            for (const identity of installationAdmin.identities) {
                cleanupRequired = true;
                identity.deleted = true;
                await this.userDb.deleteTokens(identity);
            }
            if (cleanupRequired) {
                await this.userDb.storeUser(installationAdmin);
                log.info("Cleaned up SCM connections of installation admin.");
            }

            return undefined;
        } catch (err) {
            log.error("Failed to clean up SCM connections of installation admin.", err);
            throw err;
        }
    }
}
