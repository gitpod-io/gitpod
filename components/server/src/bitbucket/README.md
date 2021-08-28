# BitBucket Integration tests

To run the BitBucket integration tests via `npm test` the `GITPOD_TEST_TOKEN_BITBUCKET` environment variable needs to be defined:

```bash
export GITPOD_TEST_TOKEN_BITBUCKET='{ value: "$token", scopes: [] }'
```

Replace `$token` with the integration test token.

