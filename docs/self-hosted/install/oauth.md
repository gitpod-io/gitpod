---
url: /docs/self-hosted/latest/install/oauth/
---

# How To integrate Gitpod with OAuth providers

Gitpod does not implement user authentication itself, but integrates with other auth provider using [OAuth2](https://oauth.net/2/).
Usually your Git hosting solution (e.g. GitHub or GitLab) acts as the OAuth auth provider. This way we control access to Gitpod while at
the same time making sure every user has proper access to their Git repository.

Gitpod supports the following authentication providers:
* github.com
* GitHub Enterprise in version 2.16.x and higher
* gitlab.com
* GitLab Community/Enterprise Edition in version 11.7.x and higher
* Bitbucket.com

On first access, a fresh Gitpod installation guides the first users to configure one or more OAuth providers.

Alternatively, you can configure it per Helm values file:
 1. Configure an OAuth app per instructions linked below (cmp. [GitHub](#GitHub) or [GitLab](#GitLab)) and copy the `clientId` and `clientSecret`.

 2. Merge the following into your `values.custom.yaml`:
    ```yaml
    authProviders:
    - id: "Public-GitHub"
      host: "github.com"
      type: "GitHub"
      oauth:
        clientId: "CLIENT_ID"
        clientSecret: "SECRET"
        callBackUrl: "https://gitpod.io/auth/github/callback"
        settingsUrl: "https://github.com/settings/connections/applications/CLIENT_ID"
      description: ""
      icon: ""
    - id: "Public-GitLab"
      host: "gitlab.com"
      type: "GitLab"
      oauth:
        clientId: "CLIENT_ID"
        clientSecret: "SECRET"
        callBackUrl: "https://gitpod.io/auth/gitlab/callback"
        settingsUrl: "https://gitlab.com/profile/applications"
      description: ""
      icon: ""
    ```
    Replace `CLIENT_ID` and `SECRET` with their respective values.

 3. Do a `helm upgrade --install -f values.custom.yaml gitpod gitpod.io/gitpod --version=0.8.0` to apply the changes.

## GitHub
To authenticate your users with GitHub you need to create a [GitHub OAuth App](https://developer.github.com/apps/building-oauth-apps/creating-an-oauth-app/).
Follow the guide linked above and:
   - Set "Authentication callback URL" to:

     https://<your-domain.com>/auth/github/callback

   - Copy `clientId` and `clientSecret`

## GitLab
To authenticate your users with GitLab you need to create an [GitLab OAuth application](https://docs.gitlab.com/ee/integration/oauth_provider.html).
Follow the guide linked above and:
   - Set "Authentication callback URL" to:

    https://<your-domain.com>/auth/<gitlab.com-OR-your-gitlab.com>/callback

   - Set "Scopes" to `api`, `read_user` and `read_repository`.
   - Copy the following values:
      - `clientId` is the "Application ID" from the GitLab OAuth appication
      - `clientSecret` is the "Secret" from the GitLab OAuth appication
