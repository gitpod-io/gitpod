/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { Suspense, useContext, useEffect, useState } from 'react';
import Menu from './components/Menu';
import { BrowserRouter } from "react-router-dom";
import { Route, Switch } from "react-router";
import { Workspaces } from './workspaces/Workspaces';
import { CreateWorkspace } from './start/CreateWorkspace';
import StartWorkspace from './start/StartWorkspace';
import { Login } from './Login';
import { UserContext } from './user-context';
import { getGitpodService } from './service/service';
import Header from './components/Header';

const Account = React.lazy(() => import(/* webpackPrefetch: true */ './settings/Account'));
const Notifications = React.lazy(() => import(/* webpackPrefetch: true */ './settings/Notifications'));
const Plans = React.lazy(() => import(/* webpackPrefetch: true */ './settings/Plans'));
const EnvironmentVariables = React.lazy(() => import(/* webpackPrefetch: true */ './settings/EnvironmentVariables'));
const Integrations = React.lazy(() => import(/* webpackPrefetch: true */ './settings/Integrations'));
const Preferences = React.lazy(() => import(/* webpackPrefetch: true */ './settings/Preferences'));

function Loading() {
    return <>
        <Header title="" subtitle="" />
    </>;
}

function App() {
    const { user, setUser } = useContext(UserContext);

    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        (async () => {
            try {
                setUser(await getGitpodService().server.getLoggedInUser());
            } catch (error) {
                console.log(error);
            }
            setLoading(false);
        })();
    }, []);

    if (!loading && !user) {
        return (<Login />)
    };

    window.addEventListener("hashchange", () => {
      // Refresh on hash change if the path is '/' (new context URL)
      if (window.location.pathname === '/') {
        window.location.reload(true);
      }
    }, false);

    const hash = getURLHash();
    if (window.location.pathname === '/' && hash !== '') {
      return <CreateWorkspace contextUrl={hash} />;
    }
    if (/\/start\/?/.test(window.location.pathname) && hash !== '') {
      return <StartWorkspace workspaceId={hash} />;
    }

    return (
        <BrowserRouter>
            <div className="container">
                {user && renderMenu()}

                <Suspense fallback={<Loading />}>
                    <Switch>
                        {user && (
                            <React.Fragment>
                                <Route path={["/", "/workspaces"]} exact render={
                                    () => <Workspaces />} />
                                <Route path={["/account", "/settings"]} exact component={Account} />
                                <Route path={["/integrations", "/access-control"]} exact component={Integrations} />
                                <Route path="/notifications" exact component={Notifications} />
                                <Route path="/plans" exact component={Plans} />
                                <Route path="/variables" exact component={EnvironmentVariables} />
                                <Route path="/preferences" exact component={Preferences} />
                            </React.Fragment>
                        )}
                    </Switch>
                </Suspense>
            </div>
        </BrowserRouter>
    );
}

function getURLHash () {
  return window.location.hash.replace(/^[#/]+/, '');
}

const renderMenu = () => (
    <Menu left={[
        {
            title: 'Workspaces',
            link: '/workspaces'
        },
        {
            title: 'Settings',
            link: '/settings',
            matches: /^(?!.*workspace).*$/
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
        ]}
    />)

export default App;
