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
const Notifications = React.lazy(() => import('./account/Notifications'));
const Profile = React.lazy(() => import('./account/Profile'));
const Subscriptions = React.lazy(() => import('./account/Subscriptions'));
const DefaultIDE = React.lazy(() => import('./settings/DefaultIDE'));
const EnvVars = React.lazy(() => import('./settings/EnvVars'));
const FeaturePreview = React.lazy(() => import('./settings/FeaturePreview'));
const GitIntegration = React.lazy(() => import('./settings/GitIntegration'));
```

Global state is passed through `React.Context`.
