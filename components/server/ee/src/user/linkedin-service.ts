/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { inject, injectable } from "inversify";
import fetch from "node-fetch";
import { ResponseError } from "vscode-jsonrpc";
import { Config } from "../../../src/config";

@injectable()
export class LinkedInService {
    @inject(Config) protected readonly config: Config;

    async getAccessToken(code: string) {
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
        return data;
    }
}
