/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject, postConstruct } from 'inversify';
import { init, Instance, dispose, isEnabled, hasEnoughSeats, inspect, validate } from "./nativemodule";
import { Feature, LicensePayload } from './api';

export const LicenseKeySource = Symbol("LicenseKeySource");

export interface LicenseKeySource {
    // getKey returns a license key
    getKey(): Promise<{
        key: string,
        domain: string
    }>;
}

@injectable()
export class LicenseEvaluator {
    @inject(LicenseKeySource) protected keySource: LicenseKeySource;
    protected instanceID: Instance;

    @postConstruct()
    protected async init() {
        const { key, domain } = await this.keySource.getKey();
        this.instanceID = init(key, domain);

        const { msg, valid } = validate(this.instanceID);
        if (!valid) {
            console.error(`invalid license: falling back to default`, {domain, msg});
        } else {
            console.log("enterprise license accepted", this.inspect());
        }
    }

    public async reloadLicense() {
        this.dispose()
        await this.init()
    }

    public validate(): { msg?: string, valid: boolean } {
        const v = validate(this.instanceID);
        if (v.valid) {
            return { valid: true };
        }
        return { msg: v.msg, valid: false };
    }

    public isEnabled(feature: Feature, seats: number): boolean {
        return isEnabled(this.instanceID, feature, seats);
    }

    public hasEnoughSeats(seats: number): boolean {
        return hasEnoughSeats(this.instanceID, seats);
    }

    public inspect(): LicensePayload {
        return JSON.parse(inspect(this.instanceID));
    }

    public dispose() {
        dispose(this.instanceID);
    }

}
