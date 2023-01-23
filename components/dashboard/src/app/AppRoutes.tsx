/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { FunctionComponent, useContext, useState } from "react";
import { ContextURL, User, Team } from "@gitpod/gitpod-protocol";
import SelectIDEModal from "../settings/SelectIDEModal";
import { StartPage, StartPhase } from "../start/StartPage";
import { getURLHash, isGitpodIo, isLocalPreview } from "../utils";
import { shouldSeeWhatsNew, WhatsNew } from "../whatsnew/WhatsNew";
import { Redirect, Route, Switch } from "react-router";
import Menu from "../Menu";
import { parseProps } from "../start/StartWorkspace";
import { AppNotifications } from "../AppNotifications";
import { AdminRoute } from "./AdminRoute";
import { StartWorkspaceModal } from "../workspaces/StartWorkspaceModal";
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
    settingsPathPersonalAccessTokens,
    settingsPathPersonalAccessTokenCreate,
    settingsPathPersonalAccessTokenEdit,
} from "../settings/settings.routes";
import {
    projectsPathInstallGitHubApp,
    projectsPathMain,
    projectsPathMainWithParams,
    projectsPathNew,
} from "../projects/projects.routes";
import { workspacesPathMain } from "../workspaces/workspaces.routes";
import { LocalPreviewAlert } from "./LocalPreviewAlert";
import OAuthClientApproval from "../OauthClientApproval";
import { Blocked } from "./Blocked";

// TODO: Can we bundle-split/lazy load these like other pages?
import { BlockedRepositories } from "../admin/BlockedRepositories";
import PersonalAccessTokenCreateView from "../settings/PersonalAccessTokensCreateView";
import { StartWorkspaceModalContext } from "../workspaces/start-workspace-modal-context";
import { StartWorkspaceOptions } from "../start/start-workspace-options";
import { WebsocketClients } from "./WebsocketClients";

const Setup = React.lazy(() => import(/* webpackPrefetch: true */ "../Setup"));
const WorkspacesNew = React.lazy(() => import(/* webpackPrefetch: true */ "../workspaces/WorkspacesNew"));
const Account = React.lazy(() => import(/* webpackPrefetch: true */ "../settings/Account"));
const Notifications = React.lazy(() => import(/* webpackPrefetch: true */ "../settings/Notifications"));
const Billing = React.lazy(() => import(/* webpackPrefetch: true */ "../settings/Billing"));
const Plans = React.lazy(() => import(/* webpackPrefetch: true */ "../settings/Plans"));
const Teams = React.lazy(() => import(/* webpackPrefetch: true */ "../settings/Teams"));
const EnvironmentVariables = React.lazy(() => import(/* webpackPrefetch: true */ "../settings/EnvironmentVariables"));
const SSHKeys = React.lazy(() => import(/* webpackPrefetch: true */ "../settings/SSHKeys"));
const Integrations = React.lazy(() => import(/* webpackPrefetch: true */ "../settings/Integrations"));
const Preferences = React.lazy(() => import(/* webpackPrefetch: true */ "../settings/Preferences"));
const PersonalAccessTokens = React.lazy(() => import(/* webpackPrefetch: true */ "../settings/PersonalAccessTokens"));
const Open = React.lazy(() => import(/* webpackPrefetch: true */ "../start/Open"));
const StartWorkspace = React.lazy(() => import(/* webpackPrefetch: true */ "../start/StartWorkspace"));
const CreateWorkspace = React.lazy(() => import(/* webpackPrefetch: true */ "../start/CreateWorkspace"));
const NewTeam = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/NewTeam"));
const JoinTeam = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/JoinTeam"));
const Members = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/Members"));
const TeamSettings = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/TeamSettings"));
const TeamBilling = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/TeamBilling"));
const SSO = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/SSO"));
const TeamUsage = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/TeamUsage"));
const NewProject = React.lazy(() => import(/* webpackPrefetch: true */ "../projects/NewProject"));
const Projects = React.lazy(() => import(/* webpackPrefetch: true */ "../projects/Projects"));
const Project = React.lazy(() => import(/* webpackPrefetch: true */ "../projects/Project"));
const Events = React.lazy(() => import(/* webpackPrefetch: true */ "../projects/Events"));
const ProjectSettings = React.lazy(() => import(/* webpackPrefetch: true */ "../projects/ProjectSettings"));
const ProjectVariables = React.lazy(() => import(/* webpackPrefetch: true */ "../projects/ProjectVariables"));
const Prebuilds = React.lazy(() => import(/* webpackPrefetch: true */ "../projects/Prebuilds"));
const Prebuild = React.lazy(() => import(/* webpackPrefetch: true */ "../projects/Prebuild"));
const InstallGitHubApp = React.lazy(() => import(/* webpackPrefetch: true */ "../projects/InstallGitHubApp"));
const FromReferrer = React.lazy(() => import(/* webpackPrefetch: true */ "../FromReferrer"));
const UserSearch = React.lazy(() => import(/* webpackPrefetch: true */ "../admin/UserSearch"));
const WorkspacesSearch = React.lazy(() => import(/* webpackPrefetch: true */ "../admin/WorkspacesSearch"));
const AdminSettings = React.lazy(() => import(/* webpackPrefetch: true */ "../admin/Settings"));
const ProjectsSearch = React.lazy(() => import(/* webpackPrefetch: true */ "../admin/ProjectsSearch"));
const TeamsSearch = React.lazy(() => import(/* webpackPrefetch: true */ "../admin/TeamsSearch"));
const License = React.lazy(() => import(/* webpackPrefetch: true */ "../admin/License"));
const Usage = React.lazy(() => import(/* webpackPrefetch: true */ "../Usage"));

type AppRoutesProps = {
    user: User;
    teams?: Team[];
};
export const AppRoutes: FunctionComponent<AppRoutesProps> = ({ user, teams }) => {
    const hash = getURLHash();
    const { startWorkspaceModalProps, setStartWorkspaceModalProps } = useContext(StartWorkspaceModalContext);
    const [isWhatsNewShown, setWhatsNewShown] = useState(shouldSeeWhatsNew(user));

    // Prefix with `/#referrer` will specify an IDE for workspace
    // We don't need to show IDE preference in this case
    const [showUserIdePreference, setShowUserIdePreference] = useState(
        User.isOnboardingUser(user) && !hash.startsWith(ContextURL.REFERRER_PREFIX),
    );

    // TODO: Add a Route for this instead of inspecting location manually
    if (window.location.pathname.startsWith("/blocked")) {
        return <Blocked />;
    }

    // TODO: Add a Route for this instead of inspecting location manually
    if (window.location.pathname.startsWith("/oauth-approval")) {
        return <OAuthClientApproval />;
    }

    if (isWhatsNewShown) {
        return <WhatsNew onClose={() => setWhatsNewShown(false)} />;
    }

    // TODO: Try and encapsulate this in a route for "/" (check for hash in route component, render or redirect accordingly)
    const isCreation = window.location.pathname === "/" && hash !== "";
    if (isCreation) {
        if (showUserIdePreference) {
            return (
                <StartPage phase={StartPhase.Checking}>
                    <SelectIDEModal location="workspace_start" onClose={() => setShowUserIdePreference(false)} />
                </StartPage>
            );
        } else if (new URLSearchParams(window.location.search).has("showOptions")) {
            const props = StartWorkspaceOptions.parseSearchParams(window.location.search);
            return (
                <StartWorkspaceModal
                    {...{
                        contextUrl: hash,
                        ide: props?.ideSettings?.defaultIde,
                        uselatestIde: props?.ideSettings?.useLatestVersion,
                        workspaceClass: props.workspaceClass,
                        onClose: undefined,
                    }}
                />
            );
        } else {
            return <CreateWorkspace contextUrl={hash} />;
        }
    }

    // TODO: Try and make this a <Route/> entry instead
    const isWsStart = /\/start\/?/.test(window.location.pathname) && hash !== "";
    if (isWsStart) {
        return <StartWorkspace {...parseProps(hash, window.location.search)} />;
    }

    // TODO: Add some context to what this logic is for
    if (/^(github|gitlab)\.com\/.+?/i.test(window.location.pathname)) {
        let url = new URL(window.location.href);
        url.hash = url.pathname;
        url.pathname = "/";
        window.location.replace(url);
        return <div></div>;
    }

    return (
        <Route>
            <div className="container">
                <Menu />
                {isLocalPreview() && <LocalPreviewAlert />}
                <AppNotifications />
                <Switch>
                    <Route path={projectsPathNew} exact component={NewProject} />
                    <Route path="/open" exact component={Open} />
                    <Route path="/setup" exact component={Setup} />
                    <Route path={workspacesPathMain} exact component={WorkspacesNew} />
                    <Route path={settingsPathAccount} exact component={Account} />
                    <Route path={usagePathMain} exact component={Usage} />
                    <Route path={settingsPathIntegrations} exact component={Integrations} />
                    <Route path={settingsPathNotifications} exact component={Notifications} />
                    <Route path={settingsPathBilling} exact component={Billing} />
                    <Route path={settingsPathPlans} exact component={Plans} />
                    <Route path={settingsPathVariables} exact component={EnvironmentVariables} />
                    <Route path={settingsPathSSHKeys} exact component={SSHKeys} />
                    <Route path={settingsPathPersonalAccessTokens} exact component={PersonalAccessTokens} />
                    <Route
                        path={settingsPathPersonalAccessTokenCreate}
                        exact
                        component={PersonalAccessTokenCreateView}
                    />
                    <Route
                        path={settingsPathPersonalAccessTokenEdit + "/:tokenId"}
                        exact
                        component={PersonalAccessTokenCreateView}
                    />
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
                                        case "members":
                                            return <Members />;
                                        case "settings":
                                            return <TeamSettings />;
                                        case "billing":
                                            return <TeamBilling />;
                                        case "sso":
                                            return <SSO />;
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
                {startWorkspaceModalProps && (
                    <StartWorkspaceModal
                        {...startWorkspaceModalProps}
                        onClose={startWorkspaceModalProps.onClose || (() => setStartWorkspaceModalProps(undefined))}
                    />
                )}
            </div>
            <WebsocketClients />
        </Route>
    );
};
