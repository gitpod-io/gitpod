<p align="center">
  <a href="https://www.gitpod.io">
    <img src="https://raw.githubusercontent.com/gitpod-io/gitpod/master/components/dashboard/src/icons/gitpod.svg" alt="Gitpod Logo" height="60" />
    <br />
    <strong>Gitpod</strong>
  </a>
  <br />
  <span>Always ready-to-code.</span>
</p>
<p align="center">
  <a href="https://gitpod.io/from-referrer/">
    <img src="https://img.shields.io/badge/Gitpod-ready--to--code-908a85?logo=gitpod" alt="Gitpod ready-to-code" />
  </a>
  <a href="https://werft.gitpod-dev.com/">
    <img src="https://img.shields.io/badge/Werft.dev-CI--builds-green" alt="Werft.dev - Gitpod CI" />
  </a>
  <a href="https://www.gitpod.io/chat">
    <img src="https://img.shields.io/discord/816244985187008514" alt="Discord" />
  </a>
</p>

Gitpod is an open-source Kubernetes application for ready-to-code cloud development environments that spins up fresh, automated dev environments
for each task, in the cloud, in seconds. It enables you to describe your dev environment as code and start instant, remote and cloud development environments directly from your browser or your Desktop IDE.

Tightly integrated with GitLab, GitHub, and Bitbucket, Gitpod automatically and continuously prebuilds dev environments for all your branches. As a result, team members can instantly start coding with fresh, ephemeral, and fully-compiled dev environments - no matter if you are building a new feature, want to fix a bug, or do a code review.

![browser-vscode](https://user-images.githubusercontent.com/22498066/135150975-23bba3a6-f099-48c5-83ed-a1a6627ff0e9.png)

## Features

🏗 [Dev environments as code](https://www.gitpod.io/docs/#-dev-environments-as-code) - Gitpod applies lessons learned from infrastructure-as-code. Spinning up dev environments is easily repeatable and reproducible empowering you to automate, version-control, and share dev environments across your team.

⚡️ [Prebuilt dev environments](https://www.gitpod.io/docs/#prebuilds) - Gitpod continuously prebuilds all your git branches similar to a CI server. Control how Gitpod pre-configures and initializes environments before you even start a workspace through `init` commands in your `.gitpod.yml`.

🐳 [Integrated Docker build](https://www.gitpod.io/docs/config-docker/) - Gitpod instantly starts a container in the cloud based on your Docker image. Tools that are required for your project are easy to install and configure.

👐 [GitLab, GitHub, and Bitbucket integration](https://www.gitpod.io/docs/integrations/) - Gitpod seamlessly integrates into your workflow and works with all major git hosting platforms including GitHub, GitLab and Bitbucket.

👀 [Integrated code reviews](https://www.gitpod.io/docs/context-urls#pullmerge-request-context) - with Gitpod you can do native code reviews on any PR/MR. No need to switch context anymore and clutter your local machine with your colleagues' PR/MR.

👯‍♀️ [Collaboration](https://www.gitpod.io/docs/sharing-and-collaboration/) - invite team members to your dev environment or snapshot any state of your dev environment to share it with your team asynchronously.

🛠 Professional & customizable developer experience - a Gitpod workspace gives you the same capabilities (yes, even [root & docker](https://www.gitpod.io/docs/config-docker#configure-a-custom-dockerfile)) as your Linux machine - pre-configured and optimized for your individual development workflow. Install any [VS Code extension](https://www.gitpod.io/docs/vscode-extensions/) with one click on a user and/or team level.

[Learn more 👉](https://www.gitpod.io/)

## Getting Started

You can start using Gitpod in one or more of the following ways:

1. Quickstart using an [Example Project](https://www.gitpod.io/docs/quickstart) or [OSS Project](https://contribute.dev/)
1. Getting started with [one of your existing projects](https://www.gitpod.io/docs/getting-started)
1. [Use a Prefixed URL](https://www.gitpod.io/docs/getting-started/#prefixed-url)
1. [Install Browser Extension](https://www.gitpod.io/docs/getting-started#browser-extension)
1. [Enable GitLab Integration](https://www.gitpod.io/docs/gitlab-integration#gitlab-integration)

## Documentation

All documentation can be found on https://www.gitpod.io/docs.
For example, see [Introduction](https://www.gitpod.io/docs) and [Getting Started](https://www.gitpod.io/docs/getting-started) sections. See also: [Gitpod Architecture](https://www.youtube.com/watch?v=svV-uE0Cdjk) 📚.

Also check out [**awesome-gitpod**](https://github.com/Gitpod-Samples/awesome-gitpod) ✨

## Questions

For questions and support please use [Discord](https://www.gitpod.io/chat).
Join the conversation, and connect with other community members. 💬

You can also follow [`@gitpod`](https://twitter.com/gitpod) for announcements and updates from our team.

## Issues

The issue tracker is used for tracking **bug reports** and **feature requests** for the Gitpod open source project as well as planning current and future development efforts. 🗺️

You can upvote [popular feature requests](https://github.com/gitpod-io/gitpod/issues?q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc) or [create a new one](https://github.com/gitpod-io/gitpod/issues/new?template=feature_request.md).

### How do GitHub Issues get prioritized?

Each Gitpod team has [its own project board](https://github.com/orgs/gitpod-io/projects) that follows a similar structure. You can find these project boards attached to [the GitHub organization](https://github.com/gitpod-io). Each team board has a "GroundWork" tab which shows current GitHub issues in progress. Each team project board also has an "inbox" where issues are sent for review by the team (and should be responded to within 48 hours). "Upvoting" by [reacting](https://docs.github.com/en/rest/reference/reactions) to GitHub issues helps signal to Gitpod that issues are important to you. If you are unsure of the status of an issue, please comment and a Gitpodder should respond to you shortly. For any other questions, please utilize the [Gitpod community](https://www.gitpod.io/community).

### Adding a new component to Gitpod

For new Go projects, please update [gitpod-ws.code-workspace](./gitpod-ws.code-workspace) to include the folder. Why? This will make it so that [IntelliSense](https://code.visualstudio.com/docs/editor/intellisense) works with your project, without having to exclusively open the project in a separate context, e.g. `code components/<my-new-component>`. References [1](https://go.googlesource.com/tools/+/refs/heads/master/gopls/doc/workspace.md#multiple-workspace-folders)[2](https://code.visualstudio.com/docs/editor/multi-root-workspaces)

## Related Projects

During the development of Gitpod, we also developed some of our own infrastructure toolings to make development easier and more efficient.
To this end, we've developed a number of open source projects including:

1. [**Werft**](https://github.com/csweichel/werft) - A Kubernetes native CI system
1. [**Leeway**](https://github.com/gitpod-io/leeway) - A heavily caching build system
1. [**Dazzle**](https://github.com/gitpod-io/dazzle/) - An experimental Docker image builder
1. [**OpenVSCode Server**](https://github.com/gitpod-io/openvscode-server) - Run the latest VS Code on a remote machine accessed through a browser

## Code of Conduct

We want to create a welcoming environment for everyone who is interested in contributing to Gitpod or participating in discussions with the Gitpod community.
This project has adopted the [Contributor Covenant Code of Conduct](https://github.com/gitpod-io/.github/blob/main/CODE_OF_CONDUCT.md), [version 2.0](https://www.contributor-covenant.org/version/2/0/code_of_conduct/).
