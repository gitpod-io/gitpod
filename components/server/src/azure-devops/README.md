# Azure DevOps Integration

## How to add integration to a preview env

Check `Gitpod Azure DevOps Integration (preview env)` item in 1P.

## How to run the tests

1. With Personal Access Token (in 1P): Update `azure-api.ts` file to use `getPersonalAccessTokenHandler` instead of `getBearerHandler`.
2. Or with Bearer Token (how server does it): Follow OAuth2 flow to get a refreshed access token.
3. Run the tests
```bash
  export AZURE_TOKEN=<token>
export GITPOD_TEST_TOKEN_AZURE_DEVOPS='{"value": "'$AZURE_TOKEN'"}'

# `yarn watch` if needed
# for all server tests `yarn test:unit`
yarn mocha './**/*/azure-*.spec.js' --exclude './node_modules/**' --exit
```
