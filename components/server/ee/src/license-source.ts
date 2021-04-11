/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { LicenseKeySource } from "@gitpod/licensor/lib";
import { inject, injectable } from "inversify";
import { Env } from "../../src/env";
import { LicenseDB } from "@gitpod/gitpod-db/lib/license-db";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class DBLicenseKeySource implements LicenseKeySource {
    @inject(Env) protected readonly env: Env;
    @inject(LicenseDB) protected readonly licenseDB: LicenseDB;

    async getKey(): Promise<{ key: string; domain: string; }> {
        let key: string = "";
        try {
            key = await this.licenseDB.get() || "";
        } catch (err) {
            log.error("cannot get license key - even if you have a license, the EE features won't work", err);
        }
        return {
            key: key || "",
            domain: this.env.hostUrl.url.host,
        };
    }

}