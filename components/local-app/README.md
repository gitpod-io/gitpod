# local-app

**Beware**: this is very much work in progress and will likely break things.

## How to install
```
docker run --rm -it -v /tmp/dest:/out eu.gcr.io/gitpod-core-dev/build/local-app:<version>
```

## How to run
```
./local-app
```

## How to run in Gitpod against a dev-staging environment
```
cd components/local-app
BROWSER= GITPOD_HOST=<URL-of-your-preview-env> go run main.go --mock-keyring run
```
