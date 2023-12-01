# Public API TypeScript Common

## Overview

This package serves as a bridge for code conversion between two distinct Gitpod packages: @gitpod/gitpod-protocol and @gitpod/public-api. Its primary responsibility is to ensure seamless translation of application data structures from the gitpod-protocol format to the public-api gRPC format, and vice versa.

## Allowed Usage

Use this package exclusively for tasks that require data structure from @gitpod/gitpod-protocol and @gitpod/public-api. It's important not to introduce dependencies on this package from gitpod-protocol or public-api to ensure changes in one package don't trigger rebuilds of unrelated components such as ws-manager-bridge and supervisor-frontend.

## Golden tests

Golden tests are used to test the output of a function against a known good output. The output is stored in a file with the same name as the test file but with a `.golden` extension. The test will fail if the output does not match the golden file.

We use golden tests for public api data conversion functions. We put the fixtures input and golden results in the `../fixtures` folder.

See example below:

```ts
it("toOrganizationMember", async () => {
    await startFixtureTest("../fixtures/toOrganizationMember_*.json", async (input) =>
        converter.toOrganizationMember(input),
    );
});
```

it will run the test for each file matching the glob pattern `../fixtures/toOrganizationMember_*.json`. The test will fail if the output does not match the `../fixtures/toOrganizationMember_*.golden` files.

### How to veirfy golden files

```bash
yarn test
```

### How to update golden files

```bash
yarn test:forceUpdate
```

### How to generate input json files

```bash
node scripts/new-fixtures.js [your_testing_name] [the_number_of_input_files]
```
