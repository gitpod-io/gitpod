#
# Auth Provider
#

authProviders:
  - id: "Public-GitHub"
    host: "github.com"
    type: "GitHub"
    oauth:
      clientId: "CLIENT_ID"
      clientSecret: "CLIENT_SECRET"
      callBackUrl: "https://your-domain.com/auth/github/callback"
      settingsUrl: "https://github.com/settings/connections/applications/CLIENT_ID"
    description: ""
    icon: ""
  - id: "Public-GitLab"
    host: "gitlab.com"
    type: "GitLab"
    oauth:
      clientId: "CLIENT_ID"
      clientSecret: "CLIENT_SECRET"
      callBackUrl: "https://gitpod.io/auth/gitlab/callback"
      settingsUrl: "https://gitlab.com/profile/applications"
    description: ""
    icon: ""

#
# Branding
#

branding:
  logo: /images/gitpod-ddd.svg
  homepage: https://www.gitpod.io/
  links:
    header:
      - name: Workspaces
        url: /workspaces/
      - name: Docs
        url: https://www.gitpod.io/docs/
      - name: Blog
        url: https://www.gitpod.io/blog/
      - name: Community
        url: https://community.gitpod.io/
    footer:
      - name: Docs
        url: https://www.gitpod.io/docs/
      - name: Blog
        url: https://www.gitpod.io/blog/
      - name: Status
        url: https://status.gitpod.io/
    social:
      - type: GitHub
        url: https://github.com/gitpod-io/gitpod
      - type: Discourse
        url: https://community.gitpod.io/
      - type: Twitter
        url: https://twitter.com/gitpod
    legal:
      - name: Imprint
        url: https://www.gitpod.io/imprint/
      - name: Privacy Policy
        url: https://www.gitpod.io/privacy/
      - name: Terms of Service
        url: https://www.gitpod.io/terms/
