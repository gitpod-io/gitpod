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

## To test the OAuth server
NOTE: needs to done locally as we cannot open a browser URL within a Gitpod workspace terminal atm
```
cd ~/
mkdir -p ~/tmp
docker pull eu.gcr.io/gitpod-core-dev/dev/local-app:rl-oauth
docker run --rm -it -v ~/tmp:/out eu.gcr.io/gitpod-core-dev/dev/local-app:rl-oauth
# assuming you are running on OSX... (use local-app-windows.exe or local-app-linux as required)
GITPOD_HOST=<URL-of-your-preview-env> ./tmp/local-app-darwin test
```
If successful it will output an OAuth token containing a Gitpod token e.g.:
```
{"access_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjaWQiOiJHaXRwb2QgbG9jYWwgY29udHJvbCBjbGllbnQiLCJzY29wZSI6ImZ1bmN0aW9uOmdldFdvcmtzcGFjZSIsInN1YiI6IjNjMTcwZjg3LWI2MTUtNDUwNS04MDFiLTUxZjczMjc5MzI5MSIsImV4cCI6MTYyMTMzNTc0NywibmJmIjoxNjIxMjQ5MzQ3LCJpYXQiOjE2MjEyNDkzNDcsImp0aSI6IjdmYzJjZTdjOWUwNjA0MGE0ZTBmOWI1OTI0NTFiYzhhYzMyMWRhZWEzMmMzZmZiZTZmMWI4OTFmNDBmMSJ9.gLVuo2pqQNQM7JKlfl-L9FaxbyGjNzTy5RHulOrGMZQ", "expires_in":86400, "refresh_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfaWQiOiJncGxjdGwtMS4wIiwiYWNjZXNzX3Rva2VuX2lkIjoiN2ZjMmNlN2M5ZTA2MDQwYTRlMGY5YjU5MjQ1MWJjOGFjMzIxZGFlYTMyYzNmZmJlNmYxYjg5MWY0MGYxIiwicmVmcmVzaF90b2tlbl9pZCI6InJlZnJlc2h0b2tlbnRva2VuIiwic2NvcGUiOiJmdW5jdGlvbjpnZXRXb3Jrc3BhY2UiLCJ1c2VyX2lkIjoiM2MxNzBmODctYjYxNS00NTA1LTgwMWItNTFmNzMyNzkzMjkxIiwiZXhwaXJlX3RpbWUiOjE2MjM4NDEzNDcsImlhdCI6MTYyMTI0OTM0Nn0.ioLDJhzSwO-QmepMur_yl-WFqMCkFD_pY9pczLFqA1M", "scope":"function:getWorkspace", "token_type":"Bearer"}
```