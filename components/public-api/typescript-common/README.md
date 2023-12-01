# Public API TypeScript Common

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
