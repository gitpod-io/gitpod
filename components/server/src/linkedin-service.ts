/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { LinkedInProfile, User } from "@gitpod/gitpod-protocol/lib/protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { LinkedInProfileDB } from "@gitpod/gitpod-db/lib";
import { inject, injectable } from "inversify";
import fetch from "node-fetch";
import { Config } from "./config";

@injectable()
export class LinkedInService {
    @inject(Config) protected readonly config: Config;
    @inject(LinkedInProfileDB) protected readonly linkedInProfileDB: LinkedInProfileDB;

    async connectWithLinkedIn(user: User, code: string): Promise<LinkedInProfile> {
        const accessToken = await this.getAccessToken(code);
        const profile = await this.getLinkedInProfile(accessToken);
        // Note: The unique mapping from LinkedIn profile to Gitpod user is guaranteed by the DB.
        await this.linkedInProfileDB.storeProfile(user.id, profile);
        return profile;
    }

    private async getAccessToken(code: string) {
        const { clientId, clientSecret } = this.config.linkedInSecrets || {};
        if (!clientId || !clientSecret) {
            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                "LinkedIn is not properly configured (no Client ID or Client Secret)",
            );
        }
        const redirectUri = this.config.hostUrl.with({ pathname: "/linkedin" }).toString();
        const url = `https://www.linkedin.com/oauth/v2/accessToken?grant_type=authorization_code&code=${code}&redirect_uri=${redirectUri}&client_id=${clientId}&client_secret=${clientSecret}`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });
        const data = await response.json();
        if (data.error) {
            throw new Error(`Could not get LinkedIn access token: ${data.error_description}`);
        }
        return data.access_token as string;
    }

    // Retrieve the user's profile from LinkedIn using the following API:
    // https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin
    private async getLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
        const profileUrl =
            "https://api.linkedin.com/v2/me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))";
        const emailUrl = "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))";

        // Fetch both the user's profile and email address in parallel
        const [profileResponse, emailResponse] = await Promise.all([
            fetch(profileUrl, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }),
            fetch(emailUrl, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }),
        ]);

        const profileData = await profileResponse.json();
        if (profileData.error) {
            throw new Error(`Could not get LinkedIn lite profile: ${profileData.error_description}`);
        }
        if (!profileData.id) {
            throw new Error("Missing LinkedIn profile ID");
        }

        const emailData = await emailResponse.json();
        if (emailData.error) {
            throw new Error(`Could not get LinkedIn email address: ${emailData.error_description}`);
        }
        if (!emailData.elements || emailData.elements.length < 1 || !emailData.elements[0]["handle~"]?.emailAddress) {
            throw new Error("Missing LinkedIn email address");
        }

        const profile: LinkedInProfile = {
            id: profileData.id,
            firstName: "",
            lastName: "",
            profilePicture: "",
            emailAddress: emailData.elements[0]["handle~"].emailAddress,
        };

        try {
            const localized = profileData.firstName?.localized;
            if (typeof localized === "object" && Object.values(localized as object).length > 0) {
                // If there are multiple first name localizations, just pick the first one
                profile.firstName = String(Object.values(localized as object)[0]);
            }
        } catch (error) {
            log.error("Error getting LinkedIn first name", error);
        }

        try {
            if (
                typeof profileData.lastName?.localized === "object" &&
                Object.values(profileData.lastName?.localized as object).length > 0
            ) {
                // If there are multiple last name localizations, just pick the first one
                profile.lastName = String(Object.values(profileData.lastName.localized as object)[0]);
            }
        } catch (error) {
            log.error("Error getting LinkedIn last name", error);
        }

        try {
            if (profileData.profilePicture && profileData.profilePicture["displayImage~"]?.elements?.length > 0) {
                // If there are multiple image sizes, just pick the first one (seems to be always the smallest size)
                profile.profilePicture = String(
                    profileData.profilePicture["displayImage~"].elements[0].identifiers[0].identifier,
                );
            }
        } catch (error) {
            log.error("Error getting LinkedIn profile picture", error);
        }

        return profile;
    }
}
