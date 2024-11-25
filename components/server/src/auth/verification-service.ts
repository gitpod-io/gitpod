/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { Config } from "../config";
import { Twilio } from "twilio";
import { ServiceContext } from "twilio/lib/rest/verify/v2/service";
import { TeamDB, UserDB } from "@gitpod/gitpod-db/lib";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { UserService } from "../user/user-service";

interface VerificationEndpoint {
    sendToken(phoneNumber: string, channel: "sms" | "call"): Promise<string>;
    verifyToken(phoneNumber: string, oneTimePassword: string, verificationId: string): Promise<boolean>;
}

class TwilioVerificationEndpoint implements VerificationEndpoint {
    constructor(private readonly config: Config) {}

    private _twilioService: ServiceContext;
    private get twilioService(): ServiceContext {
        if (!this._twilioService && this.config.twilioConfig) {
            const client = new Twilio(this.config.twilioConfig.accountSID, this.config.twilioConfig.authToken);
            this._twilioService = client.verify.v2.services(this.config.twilioConfig.serviceID);
        }
        return this._twilioService;
    }

    public async sendToken(phoneNumber: string, channel: "sms" | "call"): Promise<string> {
        if (!this.twilioService) {
            throw new Error("No verification service configured.");
        }
        const verification = await this.twilioService.verifications.create({ to: phoneNumber, channel });

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
        return verificationId;
    }
    public async verifyToken(phoneNumber: string, oneTimePassword: string, verificationId: string): Promise<boolean> {
        const verification_check = await this.twilioService.verificationChecks.create({
            to: phoneNumber,
            code: oneTimePassword,
        });

        log.info("Verification code checked", {
            verificationId,
            phoneNumber,
            status: verification_check.status,
            channel: verification_check.channel,
        });

        return verification_check.status === "approved";
    }
}

class MockVerificationEndpoint implements VerificationEndpoint {
    private verificationId = uuidv4();

    public async sendToken(phoneNumber: string, channel: "sms" | "call"): Promise<string> {
        return this.verificationId;
    }

    public async verifyToken(phoneNumber: string, oneTimePassword: string, verificationId: string): Promise<boolean> {
        if (verificationId !== this.verificationId) {
            return false;
        }
        return oneTimePassword === "123456";
    }
}

@injectable()
export class VerificationService {
    constructor(
        @inject(Config) private config: Config,
        @inject(UserDB) private userDB: UserDB,
        @inject(TeamDB) private teamDB: TeamDB,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
        @inject(UserService) private readonly userService: UserService,
    ) {
        if (this.config.twilioConfig) {
            this.verifyService = new TwilioVerificationEndpoint(this.config);
        } else if (this.config.devBranch && !this.config.isDedicatedInstallation) {
            // preview environments get the mock verification endpoint
            this.verifyService = new MockVerificationEndpoint();
        }
    }

    private verifyService?: VerificationEndpoint;

    public async needsVerification(user: User): Promise<boolean> {
        if (!this.verifyService) {
            return false;
        }
        if (!!user.lastVerificationTime) {
            return false;
        }
        // we treat existing users (created before we introduced phone vwerification) as verified
        if (user.creationDate < "2022-08-22") {
            return false;
        }
        return true;
    }

    public async verifyOrgMembers(organizationId: string): Promise<void> {
        const members = await this.teamDB.findMembersByTeam(organizationId);
        for (const member of members) {
            const user = await this.userDB.findUserById(member.userId);
            if (user && (await this.needsVerification(user))) {
                await this.userService.markUserAsVerified(user, undefined);
            }
        }
    }

    public async sendVerificationToken(
        userId: string,
        phoneNumber: string,
        channel: "sms" | "call" = "sms",
    ): Promise<string> {
        if (!this.verifyService) {
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "No verification service configured.");
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
        const verificationId = this.verifyService.sendToken(phoneNumber, channel);
        this.analytics.track({
            event: "phone_verification_sent",
            userId,
            properties: {
                verification_id: verificationId,
                requested_channel: channel,
            },
        });

        return verificationId;
    }

    public async verifyVerificationToken(
        user: User,
        phoneNumber: string,
        oneTimePassword: string,
        verificationId: string,
    ): Promise<boolean> {
        if (!this.verifyService) {
            throw new Error("No verification service configured.");
        }
        if (!uuidValidate(verificationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Verification ID must be a valid UUID");
        }

        const verified = await this.verifyService.verifyToken(phoneNumber, oneTimePassword, verificationId);

        if (verified) {
            await this.userService.markUserAsVerified(user, phoneNumber);
            this.analytics.track({
                event: "phone_verification_completed",
                userId: user.id,
                properties: {
                    verification_id: verificationId,
                },
            });
        } else {
            this.analytics.track({
                event: "phone_verification_failed",
                userId: user.id,
                properties: {
                    verification_id: verificationId,
                },
            });
        }
        return verified;
    }
}
