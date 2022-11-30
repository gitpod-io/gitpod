# Testdata/Render

This contains the test data for building the render tests.

## Purpose

These are not unit tests in the strict sense. We do not have an expectated outcome in mind when we create the test and write the code to make the tests pass. Instead, the purpose is so that we are aware of the impact of our codes changes on the generated YAML and they can be followed through the commit history.

## How to use these tests

For most developers, the requirement will be to update the golden files when they write something that changes the output in some way. That is as simple as running:

```shell
make deps
make generateRenderTests
```

It is good practice to update the [versions file](#generating-the-versions-file) at the same time as doing this with the latest build, but this will only be required when a new key/value pair has been added.

## Generating the versions file

The values in the `versions.yaml` are not important. The important thing is that the key/value pairs exist. This represents the container images and the tags used by the Installer. This will only need to be updated when a new image is added and used by the Installer.

As a convention, the values are all set to `test`.

> This `yq` syntax is [v3](https://mikefarah.gitbook.io/yq/v/v3.x/), which is the version in use by Gitpod workspaces.

```shell
# Get the VERSION from werft.gitpod-dev.com
VERSION=main.4110 make getRenderVersionManifest
```

## Generating a new test file

To generate a new test, the following process must be followed - in this example, the name of the test will be `testname`, but this should be substituted for whatever you want to call it. This becomes the test name and is how the files are stored in the codebase, so it should be descriptive.

First, create your folder:

```shell
mkdir -p ./cmd/testdata/render/testname
```

Second, create your config file and amend it as required:

```shell
go run . init > ./cmd/testdata/render/testname/config.yaml
```

Finally, generate your output:

```shell
make generateRenderTests
```
