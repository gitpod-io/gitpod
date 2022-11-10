/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { Suspense, useContext, useEffect, useState } from "react";
import Menu from "./Menu";
import { Redirect, Route, Switch } from "react-router";

import { Login } from "./Login";
import { UserContext } from "./user-context";
import { getSelectedTeamSlug, TeamsContext } from "./teams/teams-context";
import { ThemeContext } from "./theme-context";
import { getGitpodService } from "./service/service";
import { shouldSeeWhatsNew, WhatsNew } from "./whatsnew/WhatsNew";
import gitpodIcon from "./icons/gitpod.svg";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { useHistory } from "react-router-dom";
import { trackButtonOrAnchor, trackPathChange, trackLocation } from "./Analytics";
import { ContextURL, User } from "@gitpod/gitpod-protocol";
import * as GitpodCookie from "@gitpod/gitpod-protocol/lib/util/gitpod-cookie";
import { Experiment } from "./experiments";
import { workspacesPathMain } from "./workspaces/workspaces.routes";
import {
    settingsPathAccount,
    settingsPathBilling,
    settingsPathIntegrations,
    settingsPathMain,
    settingsPathNotifications,
    settingsPathPlans,
    settingsPathPreferences,
    settingsPathTeams,
    settingsPathTeamsJoin,
    settingsPathTeamsNew,
    settingsPathVariables,
    settingsPathSSHKeys,
    usagePathMain,
} from "./settings/settings.routes";
import {
    projectsPathInstallGitHubApp,
    projectsPathMain,
    projectsPathMainWithParams,
    projectsPathNew,
} from "./projects/projects.routes";
import { refreshSearchData } from "./components/RepositoryFinder";
import { StartWorkspaceModal } from "./workspaces/StartWorkspaceModal";
import { parseProps } from "./start/StartWorkspace";
import SelectIDEModal from "./settings/SelectIDEModal";
import { StartPage, StartPhase } from "./start/StartPage";
import { isGitpodIo, isLocalPreview } from "./utils";
import Alert from "./components/Alert";
import { BlockedRepositories } from "./admin/BlockedRepositories";
import { AppNotifications } from "./AppNotifications";
import { publicApiTeamsToProtocol, teamsService } from "./service/public-api";
import { FeatureFlagContext } from "./contexts/FeatureFlagContext";

const Setup = React.lazy(() => import(/* webpackPrefetch: true */ "./Setup"));
const Workspaces = React.lazy(() => import(/* webpackPrefetch: true */ "./workspaces/Workspaces"));
const Account = React.lazy(() => import(/* webpackPrefetch: true */ "./settings/Account"));
const Notifications = React.lazy(() => import(/* webpackPrefetch: true */ "./settings/Notifications"));
const Billing = React.lazy(() => import(/* webpackPrefetch: true */ "./settings/Billing"));
const Plans = React.lazy(() => import(/* webpackPrefetch: true */ "./settings/Plans"));
const Teams = React.lazy(() => import(/* webpackPrefetch: true */ "./settings/Teams"));
const EnvironmentVariables = React.lazy(() => import(/* webpackPrefetch: true */ "./settings/EnvironmentVariables"));
const SSHKeys = React.lazy(() => import(/* webpackPrefetch: true */ "./settings/SSHKeys"));
const Integrations = React.lazy(() => import(/* webpackPrefetch: true */ "./settings/Integrations"));
const Preferences = React.lazy(() => import(/* webpackPrefetch: true */ "./settings/Preferences"));
const Open = React.lazy(() => import(/* webpackPrefetch: true */ "./start/Open"));
const StartWorkspace = React.lazy(() => import(/* webpackPrefetch: true */ "./start/StartWorkspace"));
const CreateWorkspace = React.lazy(() => import(/* webpackPrefetch: true */ "./start/CreateWorkspace"));
const NewTeam = React.lazy(() => import(/* webpackPrefetch: true */ "./teams/NewTeam"));
const JoinTeam = React.lazy(() => import(/* webpackPrefetch: true */ "./teams/JoinTeam"));
const Members = React.lazy(() => import(/* webpackPrefetch: true */ "./teams/Members"));
const TeamSettings = React.lazy(() => import(/* webpackPrefetch: true */ "./teams/TeamSettings"));
const TeamBilling = React.lazy(() => import(/* webpackPrefetch: true */ "./teams/TeamBilling"));
const TeamUsage = React.lazy(() => import(/* webpackPrefetch: true */ "./teams/TeamUsage"));
const NewProject = React.lazy(() => import(/* webpackPrefetch: true */ "./projects/NewProject"));
const Projects = React.lazy(() => import(/* webpackPrefetch: true */ "./projects/Projects"));
const Project = React.lazy(() => import(/* webpackPrefetch: true */ "./projects/Project"));
const Events = React.lazy(() => import(/* webpackPrefetch: true */ "./projects/Events"));
const ProjectSettings = React.lazy(() => import(/* webpackPrefetch: true */ "./projects/ProjectSettings"));
const ProjectVariables = React.lazy(() => import(/* webpackPrefetch: true */ "./projects/ProjectVariables"));
const Prebuilds = React.lazy(() => import(/* webpackPrefetch: true */ "./projects/Prebuilds"));
const Prebuild = React.lazy(() => import(/* webpackPrefetch: true */ "./projects/Prebuild"));
const InstallGitHubApp = React.lazy(() => import(/* webpackPrefetch: true */ "./projects/InstallGitHubApp"));
const FromReferrer = React.lazy(() => import(/* webpackPrefetch: true */ "./FromReferrer"));
const UserSearch = React.lazy(() => import(/* webpackPrefetch: true */ "./admin/UserSearch"));
const WorkspacesSearch = React.lazy(() => import(/* webpackPrefetch: true */ "./admin/WorkspacesSearch"));
const AdminSettings = React.lazy(() => import(/* webpackPrefetch: true */ "./admin/Settings"));
const ProjectsSearch = React.lazy(() => import(/* webpackPrefetch: true */ "./admin/ProjectsSearch"));
const TeamsSearch = React.lazy(() => import(/* webpackPrefetch: true */ "./admin/TeamsSearch"));
const OAuthClientApproval = React.lazy(() => import(/* webpackPrefetch: true */ "./OauthClientApproval"));
const License = React.lazy(() => import(/* webpackPrefetch: true */ "./admin/License"));
const Usage = React.lazy(() => import(/* webpackPrefetch: true */ "./Usage"));

function Loading() {
    return <></>;
}

function isWebsiteSlug(pathName: string) {
    const slugs = [
        "about",
        "blog",
        "careers",
        "cde",
        "changelog",
        "chat",
        "code-of-conduct",
        "contact",
        "docs",
        "features",
        "for",
        "gitpod-vs-github-codespaces",
        "imprint",
        "media-kit",
        "memes",
        "pricing",
        "privacy",
        "security",
        "screencasts",
        "self-hosted",
        "support",
        "terms",
        "values",
    ];
    return slugs.some((slug) => pathName.startsWith("/" + slug + "/") || pathName === "/" + slug);
}

// A wrapper for <Route> that redirects to the workspaces screen if the user isn't a admin.
// This wrapper only accepts the component property
function AdminRoute({ component }: any) {
    const { user } = useContext(UserContext);
    return (
        <Route
            render={({ location }: any) =>
                user?.rolesOrPermissions?.includes("admin") ? (
                    <Route component={component}></Route>
                ) : (
                    <Redirect
                        to={{
                            pathname: "/workspaces",
                            state: { from: location },
                        }}
                    />
                )
            }
        />
    );
}

export function getURLHash() {
    return window.location.hash.replace(/^[#/]+/, "");
}

function App() {
    const { user, setUser, refreshUserBillingMode } = useContext(UserContext);
    const { teams, setTeams } = useContext(TeamsContext);
    const { setIsDark } = useContext(ThemeContext);
    const { usePublicApiTeamsService } = useContext(FeatureFlagContext);

    const [loading, setLoading] = useState<boolean>(true);
    const [isWhatsNewShown, setWhatsNewShown] = useState(false);
    const [showUserIdePreference, setShowUserIdePreference] = useState(false);
    const [isSetupRequired, setSetupRequired] = useState(false);
    const history = useHistory();

    useEffect(() => {
        (async () => {
            var user: User | undefined;
            try {
                user = await getGitpodService().server.getLoggedInUser();
                setUser(user);

                const teams = usePublicApiTeamsService
                    ? publicApiTeamsToProtocol((await teamsService.listTeams({})).teams)
                    : await getGitpodService().server.getTeams();

                {
                    // if a team was selected previously and we call the root URL (e.g. "gitpod.io"),
                    // let's continue with the team page
                    const hash = getURLHash();
                    const isRoot = window.location.pathname === "/" && hash === "";
                    if (isRoot) {
                        try {
                            const teamSlug = getSelectedTeamSlug();
                            if (teams.some((t) => t.slug === teamSlug)) {
                                history.push(`/t/${teamSlug}`);
                            }
                        } catch {}
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
            const isDark =
                localStorage.theme === "dark" ||
                (localStorage.theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
            setIsDark(isDark);
        };
        updateTheme();
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        if (mediaQuery instanceof EventTarget) {
            mediaQuery.addEventListener("change", updateTheme);
        } else {
            // backward compatibility for Safari < 14
            (mediaQuery as MediaQueryList).addListener(updateTheme);
        }
        window.addEventListener("storage", updateTheme);
        return function cleanup() {
            if (mediaQuery instanceof EventTarget) {
                mediaQuery.removeEventListener("change", updateTheme);
            } else {
                // backward compatibility for Safari < 14
                (mediaQuery as MediaQueryList).removeListener(updateTheme);
            }
            window.removeEventListener("storage", updateTheme);
        };
    }, []);

    // listen and notify Segment of client-side path updates
    useEffect(() => {
        if (isGitpodIo()) {
            // Choose which experiments to run for this session/user
            Experiment.set(Experiment.seed(true));
        }
    }, []);

    useEffect(() => {
        return history.listen((location: any) => {
            const path = window.location.pathname;
            trackPathChange({
                prev: (window as any)._gp.path,
                path: path,
            });
            (window as any)._gp.path = path;
        });
    }, [history]);

    useEffect(() => {
        const handleButtonOrAnchorTracking = (props: MouseEvent) => {
            var curr = props.target as HTMLElement;
            //check if current target or any ancestor up to document is button or anchor
            while (!(curr instanceof Document)) {
                if (
                    curr instanceof HTMLButtonElement ||
                    curr instanceof HTMLAnchorElement ||
                    (curr instanceof HTMLDivElement && curr.onclick)
                ) {
                    trackButtonOrAnchor(curr);
                    break; //finding first ancestor is sufficient
                }
                curr = curr.parentNode as HTMLElement;
            }
        };
        window.addEventListener("click", handleButtonOrAnchorTracking, true);
        return () => window.removeEventListener("click", handleButtonOrAnchorTracking, true);
    }, []);

    useEffect(() => {
        if (user) {
            refreshSearchData("", user);
        }
    }, [user]);

    useEffect(() => {
        if (!teams) {
            return;
        }
        // Refresh billing mode (side effect on other components per UserContext!)
        refreshUserBillingMode();
    }, [teams]);

    // redirect to website for any website slugs
    if (isGitpodIo() && isWebsiteSlug(window.location.pathname)) {
        window.location.host = "www.gitpod.io";
        return <div></div>;
    }

    if (isGitpodIo() && window.location.pathname === "/" && window.location.hash === "" && !loading && !user) {
        if (!GitpodCookie.isPresent(document.cookie)) {
            window.location.href = `https://www.gitpod.io`;
            return <div></div>;
        } else {
            // explicitly render the Login page when the session is out-of-sync with the Gitpod cookie
            return <Login />;
        }
    }

    if (loading) {
        return <Loading />;
    }
    if (isSetupRequired) {
        return (
            <Suspense fallback={<Loading />}>
                <Setup />
            </Suspense>
        );
    }
    if (!user) {
        return <Login />;
    }

    if (window.location.pathname.startsWith("/blocked")) {
        return (
            <div className="mt-48 text-center">
                <img src={gitpodIcon} className="h-16 mx-auto" alt="Gitpod's logo" />
                <h1 className="mt-12 text-gray-500 text-3xl">Your account has been blocked.</h1>
                <p className="mt-4 mb-8 text-lg w-96 mx-auto">
                    Please contact support if you think this is an error. See also{" "}
                    <a className="hover:text-blue-600 dark:hover:text-blue-400" href="https://www.gitpod.io/terms/">
                        terms of service
                    </a>
                    .
                </p>
                <a className="mx-auto" href="mailto:support@gitpod.io?Subject=Blocked">
                    <button className="secondary">Contact Support</button>
                </a>
            </div>
        );
    }
    const shouldWhatsNewShown = shouldSeeWhatsNew(user);
    if (shouldWhatsNewShown !== isWhatsNewShown) {
        setWhatsNewShown(shouldWhatsNewShown);
    }
    if (window.location.pathname.startsWith("/oauth-approval")) {
        return (
            <Suspense fallback={<Loading />}>
                <OAuthClientApproval />
            </Suspense>
        );
    }

    window.addEventListener(
        "hashchange",
        () => {
            // Refresh on hash change if the path is '/' (new context URL)
            if (window.location.pathname === "/") {
                window.location.reload();
            }
        },
        false,
    );

    let toRender: React.ReactElement = (
        <Route>
            <div className="container">
                <Menu />
                {isLocalPreview() && (
                    <div className="app-container mt-2">
                        <Alert type="warning" className="app-container rounded-md">
                            You are using a <b>local preview</b> installation, intended for exploring the product on a
                            single machine without requiring a Kubernetes cluster.{" "}
                            <a
                                className="gp-link hover:text-gray-600"
                                href="https://www.gitpod.io/community-license?utm_source=local-preview"
                            >
                                Request a community license
                            </a>{" "}
                            or{" "}
                            <a
                                className="gp-link hover:text-gray-600"
                                href="https://www.gitpod.io/contact/sales?utm_source=local-preview"
                            >
                                contact sales
                            </a>{" "}
                            to get a professional license for running Gitpod in production.
                        </Alert>
                    </div>
                )}
                <AppNotifications />
                <Switch>
                    <Route path={projectsPathNew} exact component={NewProject} />
                    <Route path="/open" exact component={Open} />
                    <Route path="/setup" exact component={Setup} />
                    <Route path={workspacesPathMain} exact component={Workspaces} />
                    <Route path={settingsPathAccount} exact component={Account} />
                    <Route path={usagePathMain} exact component={Usage} />
                    <Route path={settingsPathIntegrations} exact component={Integrations} />
                    <Route path={settingsPathNotifications} exact component={Notifications} />
                    <Route path={settingsPathBilling} exact component={Billing} />
                    <Route path={settingsPathPlans} exact component={Plans} />
                    <Route path={settingsPathVariables} exact component={EnvironmentVariables} />
                    <Route path={settingsPathSSHKeys} exact component={SSHKeys} />
                    <Route path={settingsPathPreferences} exact component={Preferences} />
                    <Route path={projectsPathInstallGitHubApp} exact component={InstallGitHubApp} />
                    <Route path="/from-referrer" exact component={FromReferrer} />

                    <AdminRoute path="/admin/users" component={UserSearch} />
                    <AdminRoute path="/admin/teams" component={TeamsSearch} />
                    <AdminRoute path="/admin/workspaces" component={WorkspacesSearch} />
                    <AdminRoute path="/admin/projects" component={ProjectsSearch} />
                    <AdminRoute path="/admin/blocked-repositories" component={BlockedRepositories} />
                    <AdminRoute path="/admin/license" component={License} />
                    <AdminRoute path="/admin/settings" component={AdminSettings} />

                    <Route path={["/", "/login"]} exact>
                        <Redirect to={workspacesPathMain} />
                    </Route>
                    <Route path={[settingsPathMain]} exact>
                        <Redirect to={settingsPathAccount} />
                    </Route>
                    <Route path={["/access-control"]} exact>
                        <Redirect to={settingsPathIntegrations} />
                    </Route>
                    <Route path={["/subscription", "/usage", "/upgrade-subscription"]} exact>
                        <Redirect to={settingsPathPlans} />
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
                    <Route path={projectsPathMain}>
                        <Route exact path={projectsPathMain} component={Projects} />
                        <Route
                            exact
                            path={projectsPathMainWithParams}
                            render={({ match }) => {
                                const { resourceOrPrebuild } = match.params;
                                switch (resourceOrPrebuild) {
                                    case "events":
                                        return <Events />;
                                    case "prebuilds":
                                        return <Prebuilds />;
                                    case "settings":
                                        return <ProjectSettings />;
                                    case "variables":
                                        return <ProjectVariables />;
                                    default:
                                        return resourceOrPrebuild ? <Prebuild /> : <Project />;
                                }
                            }}
                        />
                    </Route>
                    <Route path={settingsPathTeams}>
                        <Route exact path={settingsPathTeams} component={Teams} />
                        <Route exact path={settingsPathTeamsNew} component={NewTeam} />
                        <Route exact path={settingsPathTeamsJoin} component={JoinTeam} />
                    </Route>
                    {(teams || []).map((team) => (
                        <Route path={`/t/${team.slug}`} key={team.slug}>
                            <Route exact path={`/t/${team.slug}`}>
                                <Redirect to={`/t/${team.slug}/projects`} />
                            </Route>
                            <Route
                                exact
                                path={`/t/${team.slug}/:maybeProject/:resourceOrPrebuild?`}
                                render={({ match }) => {
                                    const { maybeProject, resourceOrPrebuild } = match.params;
                                    switch (maybeProject) {
                                        case "projects":
                                            return <Projects />;
                                        case "workspaces":
                                            return <Workspaces />;
                                        case "members":
                                            return <Members />;
                                        case "settings":
                                            return <TeamSettings />;
                                        case "billing":
                                            return <TeamBilling />;
                                        case "usage":
                                            return <TeamUsage />;
                                        default:
                                            break;
                                    }
                                    switch (resourceOrPrebuild) {
                                        case "events":
                                            return <Events />;
                                        case "prebuilds":
                                            return <Prebuilds />;
                                        case "settings":
                                            return <ProjectSettings />;
                                        case "variables":
                                            return <ProjectVariables />;
                                        default:
                                            return resourceOrPrebuild ? <Prebuild /> : <Project />;
                                    }
                                }}
                            />
                        </Route>
                    ))}
                    <Route
                        path="*"
                        render={(_match) => {
                            return isGitpodIo() ? (
                                // delegate to our website to handle the request
                                (window.location.host = "www.gitpod.io")
                            ) : (
                                <div className="mt-48 text-center">
                                    <h1 className="text-gray-500 text-3xl">404</h1>
                                    <p className="mt-4 text-lg">Page not found.</p>
                                </div>
                            );
                        }}
                    ></Route>
                </Switch>
                <StartWorkspaceModal />
            </div>
        </Route>
    );

    const hash = getURLHash();
    if (/^(https:\/\/)?github\.dev\//i.test(hash)) {
        window.location.hash = hash.replace(/^(https:\/\/)?github\.dev\//i, "https://github.com/");
        return <div></div>;
    } else if (/^([^\/]+?=[^\/]*?|prebuild)\/(https:\/\/)?github\.dev\//i.test(hash)) {
        window.location.hash = hash.replace(
            /^([^\/]+?=[^\/]*?|prebuild)\/(https:\/\/)?github\.dev\//i,
            "$1/https://github.com/",
        );
        return <div></div>;
    }
    // Prefix with `/#referrer` will specify an IDE for workspace
    // We don't need to show IDE preference in this case
    const shouldUserIdePreferenceShown = User.isOnboardingUser(user) && !hash.startsWith(ContextURL.REFERRER_PREFIX);
    if (shouldUserIdePreferenceShown !== showUserIdePreference) {
        setShowUserIdePreference(shouldUserIdePreferenceShown);
    }

    const isCreation = window.location.pathname === "/" && hash !== "";
    const isWsStart = /\/start\/?/.test(window.location.pathname) && hash !== "";
    if (isWhatsNewShown) {
        toRender = <WhatsNew onClose={() => setWhatsNewShown(false)} />;
    } else if (isCreation) {
        if (showUserIdePreference) {
            toRender = (
                <StartPage phase={StartPhase.Checking}>
                    <SelectIDEModal location="workspace_start" onClose={() => setShowUserIdePreference(false)} />
                </StartPage>
            );
        } else {
            toRender = <CreateWorkspace contextUrl={hash} />;
        }
    } else if (isWsStart) {
        toRender = <StartWorkspace {...parseProps(hash, window.location.search)} />;
    } else if (/^(github|gitlab)\.com\/.+?/i.test(window.location.pathname)) {
        let url = new URL(window.location.href);
        url.hash = url.pathname;
        url.pathname = "/";
        window.location.replace(url);
        return <div></div>;
    }

    return <Suspense fallback={<Loading />}>{toRender}</Suspense>;
}

export default App;
