/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { createServiceMock, Event } from "@gitpod/gitpod-protocol";



const gitpodServiceMock = createServiceMock({
    getLoggedInUser: async () => {
        return {
            "id": "1234",
            "creationDate": "2018-05-01T07:00:00.000Z",
            "avatarUrl": "https://avatars.githubusercontent.com/u/37021919?s=60&v=4",
            "name": "gp-test",
            "fullName": "Gitpod Tester",
            "allowsMarketingCommunication": true,
            "identities": [
                {
                    "authProviderId": "Public-GitHub",
                    "authId": "1234",
                    "authName": "GitpodTester",
                    "primaryEmail": "tester@gitpod.io",
                }
            ]
        }        
    },
    getAuthProviders: async () => {
        return [{
            "authProviderId": "Public-GitHub",
            "authProviderType": "GitHub",
            "verified": true,
            "host": "github.com",
            "icon": "",
            "description": "",
            "isReadonly": false
        },
        {
            "authProviderId": "Public-GitLab",
            "authProviderType": "GitLab",
            "verified": true,
            "host": "gitlab.com",
            "icon": "",
            "description": "",
            "isReadonly": false
        }]
    },
    getOwnAuthProviders: async () => {
        return [{
            "id": "foobar123",
            "ownerId": "1234",
            "status": "verified",
            "host": "testing.doptig.com/gitlab",
            "type": "GitLab",
            "oauth": {
              "authorizationUrl": "https://testing.doptig.com/gitlab/oauth/authorize",
              "tokenUrl": "https://testing.doptig.com/gitlab/oauth/token",
              "settingsUrl": "https://testing.doptig.com/gitlab/profile/applications",
              "callBackUrl": "https://gitpod-staging.com/auth/testing.doptig.com/gitlab/callback",
              "clientId": "clientid-123",
              "clientSecret": "redacted"
            },
            "deleted": false
          }]
    },
    onDidOpenConnection: Event.None,
    onDidCloseConnection: Event.None,
    
});

export { gitpodServiceMock };

