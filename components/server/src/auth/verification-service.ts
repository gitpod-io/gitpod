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
import { TeamDB, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { VerificationInstance } from "twilio/lib/rest/verify/v2/service/verification";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";

@injectable()
export class VerificationService {
    @inject(Config) protected config: Config;
    @inject(WorkspaceDB) protected workspaceDB: WorkspaceDB;
    @inject(UserDB) protected userDB: UserDB;
    @inject(TeamDB) protected teamDB: TeamDB;

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
        const isPhoneVerificationEnabled = await getExperimentsClientForBackend().getValueAsync(
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

    public async verifyOrgMembers(organizationId: string): Promise<void> {
        const members = await this.teamDB.findMembersByTeam(organizationId);
        for (const member of members) {
            const user = await this.userDB.findUserById(member.userId);
            if (user) {
                await this.verifyUser(user);
            }
        }
    }

    public async verifyUser(user: User): Promise<User> {
        if (await this.needsVerification(user)) {
            user = await this.userDB.storeUser(this.markVerified(user));
            log.info("User verified", { userId: user.id });
        }
        return user;
    }

    public async sendVerificationToken(
        phoneNumber: string,
        channel: "sms" | "call" = "sms",
    ): Promise<{ verification: VerificationInstance; verificationId: string }> {
        if (!this.verifyService) {
            throw new Error("No verification service configured.");
        }
        const isBlockedNumber = this.userDB.isBlockedPhoneNumber(phoneNumber);
        const usages = await this.userDB.countUsagesOfPhoneNumber(phoneNumber);
        if (usages > 3) {
            throw new ApplicationError(
                ErrorCodes.INVALID_VALUE,
                "The given phone number has been used more than three times.",
            );
        }
        if (await isBlockedNumber) {
            throw new ApplicationError(ErrorCodes.INVALID_VALUE, "The given phone number is blocked due to abuse.");
        }
        const verification = await this.verifyService.verifications.create({ to: phoneNumber, channel });

        // Create a unique id to correlate starting/completing of verification flow
        // Clients receive this and send it back when they call send the verification code
        const verificationId = uuidv4();

        log.info("Verification code sent", {
            verificationId,
            phoneNumber,
            status: verification.status,
            // actual channel verification was created on
            channel: verification.channel,
            // channel we requested - these could differ if a channel is not enabled in a specific country
            requestedChannel: channel,
        });

        // Help us identify if verification codes are not able to send via requested channel
        if (channel !== verification.channel) {
            log.info("Verification code sent via different channel than system requested", {
                verificationId,
                phoneNumber,
                status: verification.status,
                // actual channel verification was created on
                channel: verification.channel,
                // channel we requested - these could differ if a channel is not enabled in a specific country
                requestedChannel: channel,
            });
        }

        return { verification, verificationId };
    }

    public async verifyVerificationToken(
        phoneNumber: string,
        oneTimePassword: string,
        verificationId: string,
    ): Promise<{ verified: boolean; channel: string }> {
        if (!this.verifyService) {
            throw new Error("No verification service configured.");
        }
        if (!uuidValidate(verificationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Verification ID must be a valid UUID");
        }

        const verification_check = await this.verifyService.verificationChecks.create({
            to: phoneNumber,
            code: oneTimePassword,
        });

        log.info("Verification code checked", {
            verificationId,
            phoneNumber,
            status: verification_check.status,
            channel: verification_check.channel,
        });

        return {
            verified: verification_check.status === "approved",
            channel: verification_check.channel,
        };
    }
}
