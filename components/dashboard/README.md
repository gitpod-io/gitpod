# Dashboard

The dashboard is written in TypeScript and React. For styling it uses TailwindCSS which is a bit nicer than inlining CSS as it supports pseudo classes and a is a little more abstract/reusable.

The `App.tsx` is the entry point for the SPA and it uses React-Router to register all pages.

```ts
<Switch>
    <Route path="/" exact component={Workspaces} />
    <Route path="/profile" exact component={Profile} />
    <Route path="/notifications" exact component={Notifications} />
    <Route path="/subscriptions" exact component={Subscriptions} />
    <Route path="/env-vars" exact component={EnvVars} />
    <Route path="/git-integration" exact component={GitIntegration} />
    <Route path="/feature-preview" exact component={FeaturePreview} />
    <Route path="/default-ide" exact component={DefaultIDE} />
</Switch>
```

Pages are loaded lazily using `React.lazy` so that not everything needs to be loaded up-front but only when needed:

```ts
const Notifications = React.lazy(() => import("./account/Notifications"));
const Profile = React.lazy(() => import("./account/Profile"));
const Subscriptions = React.lazy(() => import("./account/Subscriptions"));
const DefaultIDE = React.lazy(() => import("./settings/DefaultIDE"));
const EnvVars = React.lazy(() => import("./settings/EnvVars"));
const FeaturePreview = React.lazy(() => import("./settings/FeaturePreview"));
const GitIntegration = React.lazy(() => import("./settings/GitIntegration"));
```

Global state is passed through `React.Context`.

After creating a new component, run the following to update the license header:
`leeway run components:update-license-header`

## How to develop in gitpod.io

All the commands in this section are meant to be executed from the `components/dashboard` directory.

### 1. Environment variables

Set the following 2 [environment variables](https://www.gitpod.io/docs/environment-variables) either [via your account settings](https://gitpod.io/variables) or [via the command line](https://www.gitpod.io/docs/environment-variables#using-the-command-line-gp-env).

You are not expected to update the values of these variables for a long time after you first set them.

> **🚨 Heads up!** Be careful when using the command line, as the `gp` CLI will restrict the scope of the variables to the current project, meaning if you are not already working from your own personal fork you'll end up having variables you can't access when you do.

You can always go to your account settings and edit the scope for each variable to something like `*/gitpod`.

```bash
# Use "gitpod.io" for the SaaS version of Gitpod, or specify the host of your self-hosted gitpod
GP_DEV_HOST=gitpod.io

# Notice the cookie name (_gitpod_io_) may be different if self-hosted.
# Read below for how to get the actual value to use instead of "AUTHENTICATION_COOKIE_VALUE"
GP_DEV_COOKIE="_gitpod_io_=AUTHENTICATION_COOKIE_VALUE"
```

Replace `AUTHENTICATION_COOKIE_VALUE` with the value of your auth cookie taken from your browser's dev tools while visiting your target Gitpod host (e.g. `s%3Axxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.XXXXXXXXXXXXXXX`).

| ℹ️ How to get the cookie name and value                                    |
| -------------------------------------------------------------------------- |
| ![Where to get the auth cookie name and value from](how-to-get-cookie.png) |

### 2. Start the dashboard app

🚀 After following the above steps, run `yarn run start` to start developing.
You can view the dashboard at https://`PORT_NUMBER`-`GITPOD_WORKSPACE_URL` (`PORT_NUMBER` is usually `3000`).

## Tests

The dashboard uses 🌳 [Cypress](https://www.cypress.io/) for integration tests.
Specs are written with 🦑 [Cypress Testing Library](https://testing-library.com/docs/cypress-testing-library/intro/).

### How to run tests in watch mode

Open a terminal, launch the dashboard app (see instructions above):

```sh
yarn start
```

When the dashboard app is up and running, open another terminal **using Bash as shell** (this is mandatory at the moment) and launch Cypress:

```sh
yarn test:integration:watch
```

Then open port 6080 in the browser and you should see Cypress' interface via VNC.
Proceed as usual with Cypress from there.

### How to run tests in batch mode

Open a terminal, launch the dashboard app (see instructions above):

```sh
yarn start
```

When the dashboard app is up and running, open another terminal and launch Cypress:

```sh
yarn test:integration:run
```

You should see Cypress running in the terminal.
