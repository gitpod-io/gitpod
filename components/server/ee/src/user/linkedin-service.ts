/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { LinkedInProfile, User } from "@gitpod/gitpod-protocol/src/protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { LinkedInProfileDB } from "@gitpod/gitpod-db/lib";
import { inject, injectable } from "inversify";
import fetch from "node-fetch";
import { ResponseError } from "vscode-jsonrpc";
import { Config } from "../../../src/config";

@injectable()
export class LinkedInService {
    @inject(Config) protected readonly config: Config;
    @inject(LinkedInProfileDB) protected readonly linkedInProfileDB: LinkedInProfileDB;

    async connectWithLinkedIn(user: User, code: string): Promise<LinkedInProfile> {
        const accessToken = await this.getAccessToken(code);
        const profile = await this.getLinkedInProfile(accessToken);
        return profile;
    }

    private async getAccessToken(code: string) {
        const { clientId, clientSecret } = this.config.linkedInSecrets || {};
        if (!clientId || !clientSecret) {
            throw new ResponseError(
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
            throw new Error(data.error_description);
        }
        return data.access_token;
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
            throw new Error(profileData.error_description);
        }
        const emailData = await emailResponse.json();
        if (emailData.error) {
            throw new Error(emailData.error_description);
        }
        log.info("Got LinkedIn data", { profileData, emailData });

        return {
            id: profileData.id,
            firstName: "",
            lastName: "",
            profilePicture: "",
            emailAddress: emailData.elements[0]["handle~"].emailAddress,
        };
    }
}
