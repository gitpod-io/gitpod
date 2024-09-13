# Azure DevOps Integration

## How to add integration to a preview env

Check `Gitpod Azure DevOps Integration (preview env)` item in 1P.

## How to run the tests

```bash
export AZURE_TOKEN=<token>
export GITPOD_TEST_TOKEN_AZURE_DEVOPS='{"value": "'$AZURE_TOKEN'"}'

# `yarn watch` if needed
yarn test:unit
```
