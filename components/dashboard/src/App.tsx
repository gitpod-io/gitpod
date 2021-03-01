import React, { Suspense } from 'react';
import Menu from './components/Menu';
import { BrowserRouter, Route, Switch } from "react-router-dom";
import { Workspaces } from './workspaces/Workspaces';
import { ServiceContext, SimpleServiceImpl } from './service/service';

const Notifications = React.lazy(() => import('./account/Notifications'));
const Profile = React.lazy(() => import('./account/Profile'));
const Subscriptions = React.lazy(() => import('./account/Subscriptions'));
const DefaultIDE = React.lazy(() => import('./settings/DefaultIDE'));
const EnvVars = React.lazy(() => import('./settings/EnvVars'));
const FeaturePreview = React.lazy(() => import('./settings/FeaturePreview'));
const GitIntegration = React.lazy(() => import('./settings/GitIntegration'));


function App() {
  return (
    <BrowserRouter>
      <ServiceContext.Provider value={new SimpleServiceImpl()}>

        <div className="container">
          <Menu left={[
            {
              title: 'Workspaces',
              link: '/'
            },
            {
              title: 'Settings',
              link: '/account'
            },
          ]}
            right={[
            {
              title: 'Docs',
              link: 'https://www.gitpod.io/docs/',
            },
            {
              title: 'Community',
              link: 'https://community.gitpod.io/',
            }
          ]} />
          <Suspense fallback={<div></div>}>
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
          </Suspense>
        </div>
      </ServiceContext.Provider>
    </BrowserRouter>
  );
}

export default App;
