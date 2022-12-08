/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LicenseKeySource } from "@gitpod/licensor/lib";
import { inject, injectable } from "inversify";
import { LicenseDB } from "@gitpod/gitpod-db/lib";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Config } from "../../src/config";

@injectable()
export class DBLicenseKeySource implements LicenseKeySource {
    @inject(Config) protected readonly config: Config;
    @inject(LicenseDB) protected readonly licenseDB: LicenseDB;

    async getKey(): Promise<{ key: string; domain: string }> {
        let key: string = "";
        try {
            key = (await this.licenseDB.get()) || "";
        } catch (err) {
            log.error("cannot get license key - even if you have a license, the EE features won't work", err);
        }
        return {
            key: key || this.config.license || "",
            domain: this.config.hostUrl.url.host,
        };
    }
}
