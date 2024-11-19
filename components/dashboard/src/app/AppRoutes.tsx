/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React from "react";
import { Redirect, Route, Switch, useLocation } from "react-router";
import OAuthClientApproval from "../OauthClientApproval";
import Menu from "../menu/Menu";
import { parseProps } from "../start/StartWorkspace";
import {
    settingsPathAccount,
    settingsPathIntegrations,
    settingsPathMain,
    settingsPathNotifications,
    settingsPathPersonalAccessTokenCreate,
    settingsPathPersonalAccessTokenEdit,
    settingsPathPersonalAccessTokens,
    settingsPathPlans,
    settingsPathPreferences,
    settingsPathSSHKeys,
    settingsPathVariables,
    switchToPAYGPathMain,
    usagePathMain,
} from "../user-settings/settings.routes";
import { getURLHash, isGitpodIo } from "../utils";
import { workspacesPathMain } from "../workspaces/workspaces.routes";
import { AdminRoute } from "./AdminRoute";
import { Blocked } from "./Blocked";

// TODO: Can we bundle-split/lazy load these like other pages?
import { BlockedRepositories } from "../admin/BlockedRepositories";
import PersonalAccessTokenCreateView from "../user-settings/PersonalAccessTokensCreateView";
import { CreateWorkspacePage } from "../workspaces/CreateWorkspacePage";
import { BlockedEmailDomains } from "../admin/BlockedEmailDomains";
import { AppNotifications } from "../AppNotifications";
import { projectsPathInstallGitHubApp } from "../projects/projects.routes";
import { Heading1, Subheading } from "@podkit/typography/Headings";
import { PrebuildDetailPage } from "../prebuilds/detail/PrebuildDetailPage";

const Workspaces = React.lazy(() => import(/* webpackPrefetch: true */ "../workspaces/Workspaces"));
const Account = React.lazy(() => import(/* webpackPrefetch: true */ "../user-settings/Account"));
const Notifications = React.lazy(() => import(/* webpackPrefetch: true */ "../user-settings/Notifications"));
const EnvironmentVariables = React.lazy(
    () => import(/* webpackPrefetch: true */ "../user-settings/EnvironmentVariables"),
);
const SSHKeys = React.lazy(() => import(/* webpackPrefetch: true */ "../user-settings/SSHKeys"));
const Integrations = React.lazy(() => import(/* webpackPrefetch: true */ "../user-settings/Integrations"));
const Preferences = React.lazy(() => import(/* webpackPrefetch: true */ "../user-settings/Preferences"));
const PersonalAccessTokens = React.lazy(
    () => import(/* webpackPrefetch: true */ "../user-settings/PersonalAccessTokens"),
);
const StartWorkspace = React.lazy(() => import(/* webpackPrefetch: true */ "../start/StartWorkspace"));
const NewTeam = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/NewTeam"));
const JoinTeam = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/JoinTeam"));
const Members = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/Members"));
const TeamSettings = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/TeamSettings"));
const TeamUsageBasedBilling = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/TeamUsageBasedBilling"));
const SSO = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/SSO"));
const TeamGitIntegrations = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/GitIntegrationsPage"));
const TeamPolicies = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/TeamPolicies"));
const TeamNetworking = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/TeamNetworking"));
const TeamAuthentication = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/TeamAuthentication"));
const InstallGitHubApp = React.lazy(() => import(/* webpackPrefetch: true */ "../projects/InstallGitHubApp"));
const FromReferrer = React.lazy(() => import(/* webpackPrefetch: true */ "../FromReferrer"));
const UserSearch = React.lazy(() => import(/* webpackPrefetch: true */ "../admin/UserSearch"));
const WorkspacesSearch = React.lazy(() => import(/* webpackPrefetch: true */ "../admin/WorkspacesSearch"));
const ProjectsSearch = React.lazy(() => import(/* webpackPrefetch: true */ "../admin/ProjectsSearch"));
const TeamsSearch = React.lazy(() => import(/* webpackPrefetch: true */ "../admin/TeamsSearch"));
const Usage = React.lazy(() => import(/* webpackPrefetch: true */ "../Usage"));
const ConfigurationListPage = React.lazy(
    () => import(/* webpackPrefetch: true */ "../repositories/list/RepositoryList"),
);
const ConfigurationDetailPage = React.lazy(
    () => import(/* webpackPrefetch: true */ "../repositories/detail/ConfigurationDetailPage"),
);

const PrebuildListPage = React.lazy(() => import(/* webpackPrefetch: true */ "../prebuilds/list/PrebuildListPage"));

export const AppRoutes = () => {
    const hash = getURLHash();
    const location = useLocation();

    // TODO: Add a Route for this instead of inspecting location manually
    if (location.pathname.startsWith("/blocked")) {
        return <Blocked />;
    }

    // TODO: Add a Route for this instead of inspecting location manually
    if (location.pathname.startsWith("/oauth-approval")) {
        return <OAuthClientApproval />;
    }

    // TODO: Try and encapsulate this in a route for "/" (check for hash in route component, render or redirect accordingly)
    const isCreation = location.pathname === "/" && hash !== "";
    if (isCreation) {
        return <Redirect to={"/new" + location.pathname + location.search + location.hash} />;
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
            <Switch>
                <Route path="/new" exact component={CreateWorkspacePage} />
                <Route path="*">
                    <div className="container">
                        <Menu />
                        <AppNotifications />
                        <Switch>
                            <Route path="/open">
                                <Redirect to="/new" />
                            </Route>
                            {/* TODO(gpl): Remove once we don't need the redirect anymore */}
                            <Route
                                path={[
                                    switchToPAYGPathMain,
                                    settingsPathPlans,
                                    "/old-team-plans",
                                    "/teams",
                                    "/subscription",
                                    "/upgrade-subscription",
                                    "/plans",
                                ]}
                                exact
                            >
                                <Redirect to={"/billing"} />
                            </Route>
                            <Route path={workspacesPathMain} exact component={Workspaces} />
                            <Route path={settingsPathAccount} exact component={Account} />
                            <Route path={usagePathMain} exact component={Usage} />
                            <Route path={settingsPathIntegrations} exact component={Integrations} />
                            <Route path={settingsPathNotifications} exact component={Notifications} />
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
                            <AdminRoute path="/admin/orgs" component={TeamsSearch} />
                            <AdminRoute path="/admin/workspaces" component={WorkspacesSearch} />
                            <AdminRoute path="/admin/projects" component={ProjectsSearch} />
                            <AdminRoute path="/admin/blocked-repositories" component={BlockedRepositories} />
                            <AdminRoute path="/admin/blocked-email-domains" component={BlockedEmailDomains} />

                            <Route path={["/", "/login", "/login/:orgSlug"]} exact>
                                <Redirect to={workspacesPathMain} />
                            </Route>
                            <Route path={[settingsPathMain]} exact>
                                <Redirect to={settingsPathAccount} />
                            </Route>
                            <Route path={["/access-control"]} exact>
                                <Redirect to={settingsPathIntegrations} />
                            </Route>
                            <Route path={["/admin"]} exact>
                                <Redirect to="/admin/users" />
                            </Route>
                            <Route path="/sorry" exact>
                                <div className="mt-48 text-center">
                                    <Heading1>Oh, no! Something went wrong!</Heading1>
                                    <Subheading className="mt-4 text-gitpod-red">
                                        {decodeURIComponent(getURLHash())}
                                    </Subheading>
                                </div>
                            </Route>
                            <Route exact path="/orgs/new" component={NewTeam} />
                            <Route exact path="/orgs/join" component={JoinTeam} />

                            {/* These routes that require a selected organization, otherwise they redirect to "/" */}
                            <Route exact path="/members" component={Members} />
                            <Route exact path="/settings" component={TeamSettings} />
                            <Route exact path="/settings/git" component={TeamGitIntegrations} />
                            <Route exact path="/settings/policy" component={TeamPolicies} />
                            <Route exact path="/settings/networking" component={TeamNetworking} />
                            <Route exact path="/settings/auth" component={TeamAuthentication} />
                            {/* TODO: migrate other org settings pages underneath /settings prefix so we can utilize nested routes */}
                            <Route exact path="/billing" component={TeamUsageBasedBilling} />
                            <Route exact path="/sso" component={SSO} />

                            <Route exact path={`/prebuilds`} component={PrebuildListPage} />
                            <Route path="/prebuilds/:prebuildId" component={PrebuildDetailPage} />
                            <Route exact path="/repositories" component={ConfigurationListPage} />
                            {/* Handles all /repositories/:id/* routes in a nested router */}
                            <Route path="/repositories/:id" component={ConfigurationDetailPage} />

                            {/* basic redirect for old team slugs */}
                            <Route path={"/t/"} exact>
                                <Redirect to="/repositories" />
                            </Route>
                            <Route path={"/projects/"}>
                                <Redirect to="/repositories" />
                            </Route>
                            {/* redirect for old user settings slugs */}
                            <Route path="/account" exact>
                                <Redirect to={settingsPathAccount} />
                            </Route>
                            <Route path="/integrations" exact>
                                <Redirect to={settingsPathIntegrations} />
                            </Route>
                            <Route path="/notifications" exact>
                                <Redirect to={settingsPathNotifications} />
                            </Route>
                            <Route path="/user/billing" exact>
                                <Redirect to={"/billing"} />
                            </Route>
                            <Route path="/preferences" exact>
                                <Redirect to={settingsPathPreferences} />
                            </Route>
                            <Route path="/variables" exact>
                                <Redirect to={settingsPathVariables} />
                            </Route>
                            <Route path="/tokens" exact>
                                <Redirect to={settingsPathPersonalAccessTokens} />
                            </Route>
                            <Route path="/tokens/create" exact>
                                <Redirect to={settingsPathPersonalAccessTokenCreate} />
                            </Route>
                            <Route path="/keys" exact>
                                <Redirect to={settingsPathSSHKeys} />
                            </Route>
                            <Route
                                path="*"
                                render={(_match) => {
                                    // delegate to our website to handle the request
                                    if (isGitpodIo()) {
                                        window.location.host = "www.gitpod.io";
                                    }

                                    return (
                                        <div className="mt-48 text-center">
                                            <Heading1>404</Heading1>
                                            <Subheading className="mt-4">Page not found.</Subheading>
                                        </div>
                                    );
                                }}
                            />
                        </Switch>
                    </div>
                </Route>
            </Switch>
        </Route>
    );
};
