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
import gitpodIcon from './icons/gitpod.svg';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';

const Setup = React.lazy(() => import(/* webpackPrefetch: true */ './Setup'));
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
const OAuthClientApproval = React.lazy(() => import(/* webpackPrefetch: true */ './OauthClientApproval'));

function Loading() {
    return <>
    </>;
}

function isGitpodIo() {
    return window.location.hostname === 'gitpod.io' || window.location.hostname === 'gitpod-staging.com' || window.location.hostname.endsWith('gitpod-dev.com')
}

function App() {
    const { user, setUser } = useContext(UserContext);

    const [loading, setLoading] = useState<boolean>(true);
    const [isWhatsNewShown, setWhatsNewShown] = useState(false);
    const [isSetupRequired, setSetupRequired] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const usr = await getGitpodService().server.getLoggedInUser()
                setUser(usr);
            } catch (error) {
                console.log(error);
                if (error && "code" in error) {
                    if (error.code === ErrorCodes.SETUP_REQUIRED) {
                        setSetupRequired(true);
                    }
                }
            }
            setLoading(false);
        })();
    }, []);

    useEffect(() => {
        const updateTheme = () => {
            const isDark = localStorage.theme === 'dark' || (localStorage.theme === 'system' && window.matchMedia("(prefers-color-scheme: dark)").matches);
            document.documentElement.classList.toggle('dark', isDark);
        }
        updateTheme();
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        if (mediaQuery instanceof EventTarget) {
            mediaQuery.addEventListener('change', updateTheme);
        } else {
            // backward compatibility for Safari < 14
            (mediaQuery as MediaQueryList).addListener(updateTheme);
        }
        window.addEventListener('storage', updateTheme);
        return function cleanup() {
            if (mediaQuery instanceof EventTarget) {
                mediaQuery.removeEventListener('change', updateTheme);
            } else {
                // backward compatibility for Safari < 14
                (mediaQuery as MediaQueryList).removeListener(updateTheme);
            }
            window.removeEventListener('storage', updateTheme);
        }
    }, []);

    if (isGitpodIo() && window.location.pathname === '/' && window.location.hash === '' && !loading && !user) {
        window.location.href = `https://www.gitpod.io`;
        return <div></div>;
    }

    if (loading) {
        return (<Loading />);
    }
    if (isSetupRequired) {
        return (<Suspense fallback={<Loading />}>
            <Setup />
        </Suspense>);
    }
    if (!user) {
        return (<Login />);
    }
    if (window.location.pathname.startsWith('/blocked')) {
        return <div className="mt-48 text-center">
            <img src={gitpodIcon} className="h-16 mx-auto" />
            <h1 className="mt-12 text-gray-500 text-3xl">Your account has been blocked.</h1>
            <p className="mt-4 mb-8 text-lg w-96 mx-auto">Please contact support if you think this is an error. See also <a className="hover:text-blue-600 dark:hover:text-blue-400" href="https://www.gitpod.io/terms/">terms of service</a>.</p>
            <a className="mx-auto" href="mailto:support@gitpod.io?Subject=Blocked"><button className="secondary">Contact Support</button></a>
        </div>;
    }
    const shouldWhatsNewShown = shouldSeeWhatsNew(user)
    if (shouldWhatsNewShown !== isWhatsNewShown) {
        setWhatsNewShown(shouldWhatsNewShown);
    }
    if (window.location.pathname.startsWith('/oauth-approval')) {
        return (
            <Suspense fallback={<Loading />}>
                <OAuthClientApproval />
            </Suspense>
        );
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
                <Route path="/setup" exact component={Setup} />
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
                    <Redirect to="/workspaces" />
                </Route>
                <Route path={["/settings"]} exact>
                    <Redirect to="/account" />
                </Route>
                <Route path={["/access-control"]} exact>
                    <Redirect to="/integrations" />
                </Route>
                <Route path={["/subscription", "/usage", "/upgrade-subscription"]} exact>
                    <Redirect to="/plans" />
                </Route>
                <Route path={["/admin"]} exact>
                    <Redirect to="/admin/users" />
                </Route>
                <Route path="/sorry" exact>
                    <div className="mt-48 text-center">
                        <h1 className="text-gray-500 text-3xl">Oh, no! Something went wrong!</h1>
                        <p className="mt-4 text-lg text-gitpod-red">{decodeURIComponent(getURLHash())}</p>
                    </div>
                </Route>
                <Route path="*" render={
                    (match) => {

                        return isGitpodIo() ?
                            // delegate to our website to handle the request
                            (window.location.host = 'www.gitpod.io') :
                                <div className="mt-48 text-center">
                                    <h1 className="text-gray-500 text-3xl">404</h1>
                                    <p className="mt-4 text-lg">Page not found.</p>
                                </div>;
                    }
                }>
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
