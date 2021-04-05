/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { Suspense, useContext, useEffect, useState } from 'react';
import Menu from './components/Menu';
import { BrowserRouter } from "react-router-dom";
import { Redirect, Route, Switch } from "react-router";

import { Login } from './Login';
import { UserContext } from './user-context';
import { getGitpodService } from './service/service';
import { shouldSeeWhatsNew, WhatsNew } from './WhatsNew';
import settingsMenu from './settings/settings-menu';
import { User } from '@gitpod/gitpod-protocol';
import { adminMenu } from './admin/admin-menu';

const Workspaces = React.lazy(() => import(/* webpackPrefetch: true */ './workspaces/Workspaces'));
const Account = React.lazy(() => import(/* webpackPrefetch: true */ './settings/Account'));
const Notifications = React.lazy(() => import(/* webpackPrefetch: true */ './settings/Notifications'));
const Plans = React.lazy(() => import(/* webpackPrefetch: true */ './settings/Plans'));
const Teams = React.lazy(() => import(/* webpackPrefetch: true */ './settings/Teams'));
const EnvironmentVariables = React.lazy(() => import(/* webpackPrefetch: true */ './settings/EnvironmentVariables'));
const Integrations = React.lazy(() => import(/* webpackPrefetch: true */ './settings/Integrations'));
const Preferences = React.lazy(() => import(/* webpackPrefetch: true */ './settings/Preferences'));
const StartWorkspace = React.lazy(() => import(/* webpackPrefetch: true */ './start/StartWorkspace'));
const CreateWorkspace = React.lazy(() => import(/* webpackPrefetch: true */ './start/CreateWorkspace'));
const InstallGitHubApp = React.lazy(() => import(/* webpackPrefetch: true */ './prebuilds/InstallGitHubApp'));
const FromReferrer = React.lazy(() => import(/* webpackPrefetch: true */ './FromReferrer'));
const UserSearch = React.lazy(() => import(/* webpackPrefetch: true */ './admin/UserSearch'));
const WorkspacesSearch = React.lazy(() => import(/* webpackPrefetch: true */ './admin/WorkspacesSearch'));

function Loading() {
    return <>
    </>;
}

function App() {
    const { user, setUser } = useContext(UserContext);

    const [loading, setLoading] = useState<boolean>(true);
    const [isWhatsNewShown, setWhatsNewShown] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const usr = await getGitpodService().server.getLoggedInUser()
                setUser(usr);
            } catch (error) {
                console.log(error);
            }
            setLoading(false);
        })();
    }, []);

    if (loading) {
        return <Loading />
    }
    if (!user) {
        return (<Login />)
    };
    const shouldWhatsNewShown = shouldSeeWhatsNew(user)
    if (shouldWhatsNewShown !== isWhatsNewShown) {
        setWhatsNewShown(shouldWhatsNewShown);
    }
    
    window.addEventListener("hashchange", () => {
        // Refresh on hash change if the path is '/' (new context URL)
        if (window.location.pathname === '/') {
            window.location.reload(true);
        }
    }, false);

    let toRender: React.ReactElement = <Route>
        <div className="container">
            {renderMenu(user)}
            <Switch>
                <Route path="/workspaces" exact component={Workspaces} />
                <Route path="/account" exact component={Account} />
                <Route path="/integrations" exact component={Integrations} />
                <Route path="/notifications" exact component={Notifications} />
                <Route path="/plans" exact component={Plans} />
                <Route path="/teams" exact component={Teams} />
                <Route path="/variables" exact component={EnvironmentVariables} />
                <Route path="/preferences" exact component={Preferences} />
                <Route path="/install-github-app" exact component={InstallGitHubApp} />
                <Route path="/from-referrer" exact component={FromReferrer} />
                
                <Route path="/admin/users" component={UserSearch} />
                <Route path="/admin/workspaces" component={WorkspacesSearch} />

                <Route path={["/", "/login"]} exact>
                    <Redirect to="/workspaces"/>
                </Route>
                <Route path={["/settings"]} exact>
                    <Redirect to="/account"/>
                </Route>
                <Route path={["/access-control"]} exact>
                    <Redirect to="/integrations"/>
                </Route>
                <Route path={["/subscription", "/usage", "/upgrade-subscription"]} exact>
                    <Redirect to="/plans"/>
                </Route>
                <Route path={["/admin"]} exact>
                    <Redirect to="/admin/users"/>
                </Route>
            </Switch>
        </div>
    </Route>;

    const hash = getURLHash();
    const isCreation = window.location.pathname === '/' && hash !== '';
    const isWsStart = /\/start\/?/.test(window.location.pathname) && hash !== '';
    if (isWhatsNewShown) {
        toRender = <WhatsNew visible={true} onClose={() => setWhatsNewShown(false)} />;
    } else if (isCreation) {
        toRender = <CreateWorkspace contextUrl={hash} />;
    } else if (isWsStart) {
        toRender = <StartWorkspace workspaceId={hash} />;
    }

    return (
        <BrowserRouter>
            <Suspense fallback={<Loading />}>
                {toRender}
            </Suspense>
        </BrowserRouter>
    );
}

function getURLHash() {
    return window.location.hash.replace(/^[#/]+/, '');
}

const renderMenu = (user?: User) => {
        const left = [
        {
            title: 'Workspaces',
            link: '/workspaces',
            alternatives: ['/']
        },
        {
            title: 'Settings',
            link: '/settings',
            alternatives: settingsMenu.flatMap(e => e.link)
        }
    ];

    if (user && user?.rolesOrPermissions?.includes('admin')) {
        left.push({
            title: 'Admin',
            link: '/admin',
            alternatives: adminMenu.flatMap(e => e.link)
        });
    }

    return <Menu 
        left={left}
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
    />;
}

export default App;
