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
    onDidOpenConnection: Event.None,
    onDidCloseConnection: Event.None,
    
});

export { gitpodServiceMock };

