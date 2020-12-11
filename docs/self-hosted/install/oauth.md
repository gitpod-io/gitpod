---
url: /docs/self-hosted/latest/install/oauth/
---
#####TODO
# How To integrate Gitpod with OAuth providers

Gitpod does not implement user authentication itself, but integrates with other auth provider using [OAuth2](https://oauth.net/2/).
Usually your Git hosting solution (e.g. GitHub or GitLab) acts as the OAuth auth provider. This way we control access to Gitpod while at
the same time making sure every user has proper access to their Git repository.

Gitpod supports the following authentication providers:
* github.com
* GitHub Enterprise in version 2.16.x and higher
* gitlab.com
* GitLab Community Edition in version 11.7.x and higher
* GitLab Enterprise Edition in version 11.7.x and higher
* Bitbucket — coming soon
* Custom Auth Provider – Inquiry Gitpod GmbH for a quote

## GitHub
To authenticate your users with GitHub you need to create a [GitHub OAuth App](https://developer.github.com/apps/building-oauth-apps/creating-an-oauth-app/).
Follow the guide linked above and:
   - set "Authentication callback URL" to: 

       
    https://<your-domain.com>/auth/github/callback
    
 
   - copy the following values and configure them in `values.yaml`:
      - `clientId`
      - `clientSecret`

## GitLab
To authenticate your users with GitLab you need to create an [GitLab OAuth application](https://docs.gitlab.com/ee/integration/oauth_provider.html).
Follow the guide linked above and:
   - set "Authentication callback URL" to: 
   
    https://<your-domain.com>/auth/<gitlab.com-OR-your-gitlab.com>/callback

   - set "Scopes" to `api`, `read_user` and `read_repository`.
   - copy the following values and configure them in `values.yaml`:
      - `clientId` is the "Application ID" from the GitLab OAuth appication
      - `clientSecret` is the "Secret" from the GitLab OAuth appication
