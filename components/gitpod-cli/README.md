# Gitpod CLI

A CLI binary that comes pre-installed within the Gitpod workspace environments.

## Description

Here are a few of the things you can do with it:

- Open a file in the IDE
- Open a URL in the IDE's preview
- Watch the progress of a running task defined on `.gitpod.yml` by attaching the terminal to its process.
- Control user-defined environment variables
- Stop the current workspace
- Notify and wait for events to happen, to control the order of execution of terminal tasks
- Make a port available on 0.0.0.0 so that it can be exposed to the Internet
- Wait for a process to listen on a port
- Print the URL of the current workspace
- Take a snapshot of the current workspace
- Create a Gitpod configuration for the current project

Learn more about it by running `gp —-help` or checking the [documentation](https://www.gitpod.io/docs/command-line-interface/).

## Useful Links

- [Usage Docs](https://www.gitpod.io/docs/command-line-interface)
- [GitHub Issues](https://github.com/gitpod-io/gitpod/labels/component%3A%20gp%20cli)

## Contributing

- The Gitpod CLI is written in [Go](https://go.dev/).
- Most of the functionalities that the CLI implements, make use of the [Supervisor API](https://github.com/gitpod-io/gitpod/tree/main/components/supervisor-api).

If you would like to contribute to this component, check the [related GitHub issues](https://github.com/gitpod-io/gitpod/labels/component%3A%20gp%20cli) or start a discussion in the Discord [#contributing](https://discord.com/channels/816244985187008514/885406100436951080) channel.

## Ownership

To know which Gitpod Team owns this component, check the [CODEOWNERS](https://github.com/gitpod-io/gitpod/blob/main/.github/CODEOWNERS).
