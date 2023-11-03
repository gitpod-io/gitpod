# local-app

## gitpod-cli

All of the accessible commands can be listed with `gitpod --help`.


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


### Configuration options

The CLI supports the configuration options listed below. They can be set either via environment variables or the `gitpod config set <key> <value>` command, which stores it in a JSON configuration file.


| Option | Description | Environment Variable | Default |
| --- | --- | --- | --- |
| host | The hostname of the Gitpod instance | GITPOD_HOST | gitpod.io |
| token | The PAT to use for authentication | GITPOD_TOKEN | - |
| org_id | The ID of the organization to use | GITPOD_ORG_ID | - |

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
