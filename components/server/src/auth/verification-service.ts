/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable, postConstruct } from "inversify";
import { Config } from "../config";
import { Twilio } from "twilio";
import { ServiceContext } from "twilio/lib/rest/verify/v2/service";
import { UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { ConfigCatClientFactory } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ResponseError } from "vscode-ws-jsonrpc";

@injectable()
export class VerificationService {
    @inject(Config) protected config: Config;
    @inject(WorkspaceDB) protected workspaceDB: WorkspaceDB;
    @inject(UserDB) protected userDB: UserDB;
    @inject(ConfigCatClientFactory) protected readonly configCatClientFactory: ConfigCatClientFactory;

    protected verifyService: ServiceContext;

    @postConstruct()
    protected initialize(): void {
        if (this.config.twilioConfig) {
            const client = new Twilio(this.config.twilioConfig.accountSID, this.config.twilioConfig.authToken);
            this.verifyService = client.verify.v2.services(this.config.twilioConfig.serviceID);
        }
    }

    public async needsVerification(user: User): Promise<boolean> {
        if (!this.config.twilioConfig) {
            return false;
        }
        if (!!user.lastVerificationTime) {
            return false;
        }
        // we treat existing users (created before we introduced phone vwerification) as verified
        if (user.creationDate < "2022-08-22") {
            return false;
        }
        const isPhoneVerificationEnabled = await this.configCatClientFactory().getValueAsync(
            "isPhoneVerificationEnabled",
            false,
            {
                user,
            },
        );
        return isPhoneVerificationEnabled;
    }

    public markVerified(user: User): User {
        user.lastVerificationTime = new Date().toISOString();
        return user;
    }

    public async sendVerificationToken(phoneNumber: string): Promise<void> {
        if (!this.verifyService) {
            throw new Error("No verification service configured.");
        }
        const isBlockedNumber = this.userDB.isBlockedPhoneNumber(phoneNumber);
        const usages = await this.userDB.countUsagesOfPhoneNumber(phoneNumber);
        if (usages > 3) {
            throw new ResponseError(
                ErrorCodes.INVALID_VALUE,
                "The given phone number has been used more than three times.",
            );
        }
        if (await isBlockedNumber) {
            throw new ResponseError(ErrorCodes.INVALID_VALUE, "The given phone number is blocked due to abuse.");
        }
        const verification = await this.verifyService.verifications.create({ to: phoneNumber, channel: "sms" });
        log.info("Verification code sent", { phoneNumber, status: verification.status });
    }

    public async verifyVerificationToken(phoneNumber: string, oneTimePassword: string): Promise<boolean> {
        if (!this.verifyService) {
            throw new Error("No verification service configured.");
        }
        const verification_check = await this.verifyService.verificationChecks.create({
            to: phoneNumber,
            code: oneTimePassword,
        });
        return verification_check.status === "approved";
    }
}
