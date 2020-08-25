# Gitpod Extension
The example of how to build the Theia-based applications with the gitpod-extension.

## Getting started

### Building the extension and app
    yarn build

### Starting the app
    cd app
    yarn start

Open http://localhost:3000 in the browser.

## Developing

Watching

    yarn watch

Start watching of the browser example.

    cd browser-app
    yarn watch

Launch `Start Browser Backend` configuration from VS code.

Open http://localhost:3000 in the browser.

## Building images

Currently there are two types of Docker images: regular (theia/Dockerfile) and debug (theia/build/debug/Dockerfile). They can be build via their `build-image.sh` scripts.

For pulling from private npmjs.org repos there is a `docker.npmrc` file with the needed auth_token for typefox-team.

See top-level README file for more yarn commands relared to building docker images.

## Publishing gitpod-extension

The user `typefox-team` can publish and retrieve the packages in `@typefox` scope.
Login.

    npm login

Publish packages with lerna to update versions properly across local packages, [more on publishing with lerna](https://github.com/lerna/lerna#publish).

    npx lerna publish

## Expected Envs.

The gitpod extension is designed to be deployed with a gitpod workspace backend, where the following envs are defined:
 - GITPOD_HOST (the url prefix to call in order to signal activity)
 - GITPOD_WORKSPACE_ID ( workspaceid is simply appended to the host)
 - GITPOD_INTERVAL (the interval for doing keep alive requests in milliseconds, defaults to '10000'. )