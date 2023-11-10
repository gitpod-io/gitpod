# local-app

## gitpod-cli

All of the accessible commands can be listed with `gitpod --help` .

### Installing

1. Download the CLI for your platform and make it executable:

```bash
wget -O gitpod https://gitpod.io/static/bin/gitpod-cli-darwin-arm64
chmod u+x gitpod
```

2. Optionally, make it available globally. On macOS:

```bash
sudo mv gitpod /usr/local/bin/
```

### Usage

Start by logging in with `gitpod login`, which will also create a default context in the configuration file (`~/.gitpod/config.yaml`).

### Development

To develop the CLI with Gitpod, you can run it just like locally, but in Gitpod workspaces, a browser and a keyring are not available. To log in despite these limitations, provide a PAT via the `GITPOD_TOKEN` environment variable, or use the `--token` flag with the login command.

#### In a Gitpod workspace

[![Open in Gitpod](https://www.gitpod.io/svg/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/gitpod-io/gitpod)

You will have gitpod-cli ready as `gitpod` on any Workspace based on `https://github.com/gitpod-io/gitpod`.

```
# Reinstall `gitpod`
leeway run components/local-app:install-cli

# Reinstall completion
leeway run components/local-app:cli-completion
```

## local-app

**Beware**: this is very much work in progress and will likely break things.

### How to install

```
docker run --rm -it -v /tmp/dest:/out eu.gcr.io/gitpod-core-dev/build/local-app:<version>
```

### How to run

```
./local-app
```

### How to run in Gitpod against a dev-staging environment

```
cd components/local-app
BROWSER= GITPOD_HOST=<URL-of-your-preview-env> go run main.go --mock-keyring run
```
