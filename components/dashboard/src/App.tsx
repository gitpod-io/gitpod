/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { Suspense, useContext, useEffect, useState } from 'react';
import Menu from './Menu';
import { Redirect, Route, Switch } from "react-router";

import { Login } from './Login';
import { UserContext } from './user-context';
import { TeamsContext } from './teams/teams-context';
import { ThemeContext } from './theme-context';
import { getGitpodService } from './service/service';
import { shouldSeeWhatsNew, WhatsNew } from './whatsnew/WhatsNew';
import gitpodIcon from './icons/gitpod.svg';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { useHistory } from 'react-router-dom';
import { trackButtonOrAnchor, trackPathChange, trackLocation } from './Analytics';
import { User } from '@gitpod/gitpod-protocol';
import * as GitpodCookie from '@gitpod/gitpod-protocol/lib/util/gitpod-cookie';

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
const NewTeam = React.lazy(() => import(/* webpackPrefetch: true */ './teams/NewTeam'));
const JoinTeam = React.lazy(() => import(/* webpackPrefetch: true */ './teams/JoinTeam'));
const Members = React.lazy(() => import(/* webpackPrefetch: true */ './teams/Members'));
const TeamSettings = React.lazy(() => import(/* webpackPrefetch: true */ './teams/TeamSettings'));
const NewProject = React.lazy(() => import(/* webpackPrefetch: true */ './projects/NewProject'));
const ConfigureProject = React.lazy(() => import(/* webpackPrefetch: true */ './projects/ConfigureProject'));
const Projects = React.lazy(() => import(/* webpackPrefetch: true */ './projects/Projects'));
const Project = React.lazy(() => import(/* webpackPrefetch: true */ './projects/Project'));
const Prebuilds = React.lazy(() => import(/* webpackPrefetch: true */ './projects/Prebuilds'));
const Prebuild = React.lazy(() => import(/* webpackPrefetch: true */ './projects/Prebuild'));
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
    return window.location.hostname === 'gitpod.io' || window.location.hostname === 'gitpod-staging.com' || window.location.hostname.endsWith('gitpod-dev.com') || window.location.hostname.endsWith('gitpod-io-dev.com')
}

function isWebsiteSlug(pathName: string) {
    const slugs = [
        'about',
        'blog',
        'careers',
        'changelog',
        'chat',
        'code-of-conduct',
        'contact',
        'docs',
        'features',
        'for',
        'gitpod-vs-github-codespaces',
        'imprint',
        'media-kit',
        'pricing',
        'privacy',
        'security',
        'screencasts',
        'self-hosted',
        'support',
        'terms',
        'values'
    ]
    return slugs.some(slug => pathName.startsWith('/' + slug + '/') || pathName === ('/' + slug));
}

function getURLHash() {
    return window.location.hash.replace(/^[#/]+/, '');
}

function App() {
    const { user, setUser } = useContext(UserContext);
    const { teams, setTeams } = useContext(TeamsContext);
    const { setIsDark } = useContext(ThemeContext);

    const [ loading, setLoading ] = useState<boolean>(true);
    const [ isWhatsNewShown, setWhatsNewShown ] = useState(false);
    const [ isSetupRequired, setSetupRequired ] = useState(false);
    const history = useHistory();

    useEffect(() => {
        (async () => {
            var user: User | undefined;
            try {
                const teamsPromise = getGitpodService().server.getTeams();

                user = await getGitpodService().server.getLoggedInUser();
                setUser(user);

                const teams = await teamsPromise;

                {
                    // if a team was selected previously and we call the root URL (e.g. "gitpod.io"),
                    // let's continue with the team page
                    const hash = getURLHash();
                    const isRoot = window.location.pathname === '/' && hash === '';
                    if (isRoot) {
                        try {
                            const teamSlug = localStorage.getItem('team-selection');
                            if (teams.some(t => t.slug === teamSlug)) {
                                history.push(`/t/${teamSlug}`);
                            }
                        } catch {
                        }
                    }
                }
                setTeams(teams);
            } catch (error) {
                console.error(error);
                if (error && "code" in error) {
                    if (error.code === ErrorCodes.SETUP_REQUIRED) {
                        setSetupRequired(true);
                    }
                }
            } finally {
                trackLocation(!!user);
            }
            setLoading(false);
            (window as any)._gp.path = window.location.pathname; //store current path to have access to previous when path changes
        })();
    }, []);

    useEffect(() => {
        const updateTheme = () => {
            const isDark = localStorage.theme === 'dark' || (localStorage.theme === 'system' && window.matchMedia("(prefers-color-scheme: dark)").matches);
            setIsDark(isDark);
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

    // listen and notify Segment of client-side path updates
    useEffect(() => {
        return history.listen((location: any) => {
            const path = window.location.pathname;
            trackPathChange({
                prev: (window as any)._gp.path,
                path: path
            });
            (window as any)._gp.path = path;
        })
    }, [history])

    useEffect(() => {
        const handleButtonOrAnchorTracking = (props: MouseEvent) => {
            var curr = props.target as HTMLElement;
            //check if current target or any ancestor up to document is button or anchor
            while (!(curr instanceof Document)) {
                if (curr instanceof HTMLButtonElement || curr instanceof HTMLAnchorElement || (curr instanceof HTMLDivElement && curr.onclick)) {
                    trackButtonOrAnchor(curr, !!user);
                    break; //finding first ancestor is sufficient
                }
                curr = curr.parentNode as HTMLElement;
            }
        }
        window.addEventListener("click", handleButtonOrAnchorTracking);
        return () => window.removeEventListener("click", handleButtonOrAnchorTracking, true);
    }, []);

    // redirect to website for any website slugs
    if (isGitpodIo() && isWebsiteSlug(window.location.pathname)) {
        window.location.host = 'www.gitpod.io';
        return <div></div>;
    }

    if (isGitpodIo() && window.location.pathname === '/' && window.location.hash === '' && !loading && !user) {
        if (!GitpodCookie.isPresent(document.cookie)) {
            window.location.href = `https://www.gitpod.io`;
            return <div></div>;
        } else {
            // explicitly render the Login page when the session is out-of-sync with the Gitpod cookie
            return (<Login />);
        }
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
            <img src={gitpodIcon} className="h-16 mx-auto" alt="Gitpod's logo" />
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
            window.location.reload();
        }
    }, false);

    let toRender: React.ReactElement = <Route>
        <div className="container">
            <Menu />
            <Switch>
                <Route path="/new" exact component={NewProject} />
                <Route path="/setup" exact component={Setup} />
                <Route path="/workspaces" exact component={Workspaces} />
                <Route path="/account" exact component={Account} />
                <Route path="/integrations" exact component={Integrations} />
                <Route path="/notifications" exact component={Notifications} />
                <Route path="/plans" exact component={Plans} />
                <Route path="/variables" exact component={EnvironmentVariables} />
                <Route path="/preferences" exact component={Preferences} />
                <Route path="/install-github-app" exact component={InstallGitHubApp} />
                <Route path="/from-referrer" exact component={FromReferrer} />

                <Route path="/admin/users" component={UserSearch} />
                <Route path="/admin/workspaces" component={WorkspacesSearch} />

                <Route path={["/", "/login"]} exact>
                    <Redirect to="/projects" />
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
                <Route path="/projects">
                    <Route exact path="/projects" component={Projects} />
                    <Route exact path="/projects/:projectName/:resourceOrPrebuild?" render={(props) => {
                        const { resourceOrPrebuild } = props.match.params;
                        if (resourceOrPrebuild === "configure") {
                            return <ConfigureProject />;
                        }
                        if (resourceOrPrebuild === "workspaces") {
                            return <Workspaces />;
                        }
                        if (resourceOrPrebuild === "prebuilds") {
                            return <Prebuilds />;
                        }
                        return resourceOrPrebuild ? <Prebuild /> : <Project />;
                    }} />
                </Route>
                <Route path="/teams">
                    <Route exact path="/teams" component={Teams} />
                    <Route exact path="/teams/new" component={NewTeam} />
                    <Route exact path="/teams/join" component={JoinTeam} />
                </Route>
                {(teams || []).map(team =>
                    <Route path={`/t/${team.slug}`} key={team.slug}>
                        <Route exact path={`/t/${team.slug}`}>
                            <Redirect to={`/t/${team.slug}/projects`} />
                        </Route>
                        <Route exact path={`/t/${team.slug}/:maybeProject/:resourceOrPrebuild?`} render={(props) => {
                            const { maybeProject, resourceOrPrebuild } = props.match.params;
                            if (maybeProject === "projects") {
                                return <Projects />;
                            }
                            if (maybeProject === "workspaces") {
                                return <Workspaces />;
                            }
                            if (maybeProject === "members") {
                                return <Members />;
                            }
                            if (maybeProject === "settings") {
                                return <TeamSettings />;
                            }
                            if (resourceOrPrebuild === "configure") {
                                return <ConfigureProject />;
                            }
                            if (resourceOrPrebuild === "workspaces") {
                                return <Workspaces />;
                            }
                            if (resourceOrPrebuild === "prebuilds") {
                                return <Prebuilds />;
                            }
                            return resourceOrPrebuild ? <Prebuild /> : <Project />;
                        }} />
                    </Route>)}
                <Route path="*" render={
                    (_match) => {

                        return isGitpodIo() ?
                            // delegate to our website to handle the request
                            (window.location.host = 'www.gitpod.io') :
                            <div className="mt-48 text-center">
                                <h1 className="text-gray-500 text-3xl">404</h1>
                                <p className="mt-4 text-lg">Page not found.</p>
                            </div>;
                    }}>
                </Route>
            </Switch>
        </div>
    </Route>;

    const hash = getURLHash();
    if (/^(https:\/\/)?github\.dev\//i.test(hash)) {
        window.location.hash = hash.replace(/^(https:\/\/)?github\.dev\//i, 'https://github.com/')
        return <div></div>
    } else if (/^([^\/]+?=[^\/]*?|prebuild)\/(https:\/\/)?github\.dev\//i.test(hash)) {
        window.location.hash = hash.replace(/^([^\/]+?=[^\/]*?|prebuild)\/(https:\/\/)?github\.dev\//i, '$1/https://github.com/')
        return <div></div>
    }
    const isCreation = window.location.pathname === '/' && hash !== '';
    const isWsStart = /\/start\/?/.test(window.location.pathname) && hash !== '';
    if (isWhatsNewShown) {
        toRender = <WhatsNew onClose={() => setWhatsNewShown(false)} />;
    } else if (isCreation) {
        toRender = <CreateWorkspace contextUrl={hash} />;
    } else if (isWsStart) {
        toRender = <StartWorkspace workspaceId={hash} />;
    } else if (/^(github|gitlab)\.com\/.+?/i.test(window.location.pathname)) {
        let url = new URL(window.location.href)
        url.hash = url.pathname
        url.pathname = '/'
        window.location.replace(url)
        return <div></div>
    }

    return (
        <Suspense fallback={<Loading />}>
            {toRender}
        </Suspense>
    );
}

export default App;
