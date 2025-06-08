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

## Dotfiles Management (`gp dotfiles`)

The `gp dotfiles` command allows you to manage the dotfiles repository linked to your Gitpod account. Dotfiles are files (e.g., `.bashrc`, `.gitconfig`) that customize your development environment. Gitpod can automatically install your dotfiles into your workspaces.

### Link Dotfiles Repository

To link a dotfiles repository, use the `link` subcommand with the URL of your repository:

```bash
gp dotfiles link <repository-url>
```

Example:
```bash
gp dotfiles link https://github.com/your-username/dotfiles.git
```
Gitpod will then attempt to clone this repository into your workspaces and run any installation scripts it finds (e.g., `install.sh`).

### Remove Linked Dotfiles Repository

To remove a previously linked dotfiles repository, use the `remove` subcommand:

```bash
gp dotfiles remove
```
This will stop Gitpod from automatically installing these dotfiles in new workspaces.

### Manually Update Dotfiles

If you've made changes to your linked dotfiles repository and want to apply them to your current workspace immediately (or to new workspaces if prebuilds are not up-to-date), you can manually trigger an update:

```bash
gp dotfiles update
```
This command will instruct Gitpod to re-clone and re-run the installation for your dotfiles.
