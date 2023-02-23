/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContextURL, Team, User } from "@gitpod/gitpod-protocol";
import React, { FunctionComponent, useContext, useState } from "react";
import { Redirect, Route, Switch, useLocation } from "react-router";
import { AppNotifications } from "../AppNotifications";
import Menu from "../menu/Menu";
import OAuthClientApproval from "../OauthClientApproval";
import { projectsPathInstallGitHubApp, projectsPathNew } from "../projects/projects.routes";
import { StartPage, StartPhase } from "../start/StartPage";
import { parseProps } from "../start/StartWorkspace";
import SelectIDEModal from "../user-settings/SelectIDEModal";
import {
    settingsPathAccount,
    settingsPathBilling,
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
    usagePathMain,
} from "../user-settings/settings.routes";
import { getURLHash, isGitpodIo, isLocalPreview } from "../utils";
import { shouldSeeWhatsNew, WhatsNew } from "../whatsnew/WhatsNew";
import { StartWorkspaceModal } from "../workspaces/StartWorkspaceModal";
import { workspacesPathMain } from "../workspaces/workspaces.routes";
import { AdminRoute } from "./AdminRoute";
import { Blocked } from "./Blocked";
import { LocalPreviewAlert } from "./LocalPreviewAlert";

// TODO: Can we bundle-split/lazy load these like other pages?
import { BlockedRepositories } from "../admin/BlockedRepositories";
import PersonalAccessTokenCreateView from "../user-settings/PersonalAccessTokensCreateView";
import { CreateWorkspacePage, useNewCreateWorkspacePage } from "../workspaces/CreateWorkspacePage";
import { StartWorkspaceModalContext } from "../workspaces/start-workspace-modal-context";
import { OrgRequiredRoute } from "./OrgRequiredRoute";
import { WebsocketClients } from "./WebsocketClients";
import { StartWorkspaceOptions } from "../start/start-workspace-options";
import { useFeatureFlags } from "../contexts/FeatureFlagContext";
import { FORCE_ONBOARDING_PARAM, FORCE_ONBOARDING_PARAM_VALUE } from "../onboarding/UserOnboarding";

const Setup = React.lazy(() => import(/* webpackPrefetch: true */ "../Setup"));
const Workspaces = React.lazy(() => import(/* webpackPrefetch: true */ "../workspaces/Workspaces"));
const Account = React.lazy(() => import(/* webpackPrefetch: true */ "../user-settings/Account"));
const Notifications = React.lazy(() => import(/* webpackPrefetch: true */ "../user-settings/Notifications"));
const Billing = React.lazy(() => import(/* webpackPrefetch: true */ "../user-settings/Billing"));
const Plans = React.lazy(() => import(/* webpackPrefetch: true */ "../user-settings/Plans"));
const ChargebeeTeams = React.lazy(() => import(/* webpackPrefetch: true */ "../user-settings/ChargebeeTeams"));
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
const CreateWorkspace = React.lazy(() => import(/* webpackPrefetch: true */ "../start/CreateWorkspace"));
const NewTeam = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/NewTeam"));
const JoinTeam = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/JoinTeam"));
const Members = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/Members"));
const TeamSettings = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/TeamSettings"));
const TeamBilling = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/TeamBilling"));
const SSO = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/SSO"));
const TeamGitIntegrations = React.lazy(() => import(/* webpackPrefetch: true */ "../teams/GitIntegrationsPage"));
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
const UserOnboarding = React.lazy(() => import(/* webpackPrefetch: true */ "../onboarding/UserOnboarding"));

type AppRoutesProps = {
    user: User;
    teams?: Team[];
};
export const AppRoutes: FunctionComponent<AppRoutesProps> = ({ user, teams }) => {
    const hash = getURLHash();
    const { startWorkspaceModalProps, setStartWorkspaceModalProps } = useContext(StartWorkspaceModalContext);
    const [isWhatsNewShown, setWhatsNewShown] = useState(shouldSeeWhatsNew(user));
    const newCreateWsPage = useNewCreateWorkspacePage();
    const location = useLocation();
    const { newSignupFlow } = useFeatureFlags();
    const search = new URLSearchParams(location.search);

    // TODO: Add a Route for this instead of inspecting location manually
    if (location.pathname.startsWith("/blocked")) {
        return <Blocked />;
    }

    // TODO: Add a Route for this instead of inspecting location manually
    if (location.pathname.startsWith("/oauth-approval")) {
        return <OAuthClientApproval />;
    }

    if (isWhatsNewShown) {
        return <WhatsNew onClose={() => setWhatsNewShown(false)} />;
    }

    // Show new signup flow if:
    // * feature flag enabled
    // * User is onboarding (no ide selected yet) OR query param `onboarding=force` is set
    const showNewSignupFlow =
        newSignupFlow &&
        (User.isOnboardingUser(user) || search.get(FORCE_ONBOARDING_PARAM) === FORCE_ONBOARDING_PARAM_VALUE);
    if (showNewSignupFlow) {
        return <UserOnboarding user={user} />;
    }

    // TODO: Try and encapsulate this in a route for "/" (check for hash in route component, render or redirect accordingly)
    const isCreation = location.pathname === "/" && hash !== "";
    if (isCreation) {
        // Prefix with `/#referrer` will specify an IDE for workspace
        // After selection is saved, user will be updated, and this condition will be false
        const showIDESelection = User.isOnboardingUser(user) && !hash.startsWith(ContextURL.REFERRER_PREFIX);
        if (showIDESelection) {
            return (
                <StartPage phase={StartPhase.Checking}>
                    <SelectIDEModal location="workspace_start" />
                </StartPage>
            );
        } else if (new URLSearchParams(location.search).has("showOptions") || newCreateWsPage) {
            return <Redirect to={"/new" + location.pathname + location.search + location.hash} />;
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

    if (newCreateWsPage && startWorkspaceModalProps) {
        const search = StartWorkspaceOptions.toSearchParams({
            ideSettings: {
                defaultIde: startWorkspaceModalProps.ide,
                useLatestVersion: startWorkspaceModalProps.uselatestIde,
            },
            workspaceClass: startWorkspaceModalProps.workspaceClass,
        });
        const hash = startWorkspaceModalProps.contextUrl ? "#" + startWorkspaceModalProps.contextUrl : "";
        setStartWorkspaceModalProps(undefined);
        return <Redirect to={"/new/" + search + hash} />;
    }

    return (
        <Route>
            <div className="container">
                <Menu />
                {isLocalPreview() && <LocalPreviewAlert />}
                <AppNotifications />
                <Switch>
                    <Route path="/new" exact component={CreateWorkspacePage} />
                    <Route path={projectsPathNew} exact component={NewProject} />
                    <Route path="/open">
                        <Redirect to="/new" />
                    </Route>
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
                    <Route exact path="/teams">
                        <Redirect to="/old-team-plans" />
                    </Route>
                    <Route exact path="/old-team-plans" component={ChargebeeTeams} />
                    {/* TODO remove the /teams/join navigation after a few weeks */}
                    <Route exact path="/teams/join" component={JoinTeam} />
                    <Route exact path="/orgs/new" component={NewTeam} />
                    <Route exact path="/orgs/join" component={JoinTeam} />
                    <Route exact path="/projects" component={Projects} />

                    {/* These routes that require a selected organization, otherwise they redirect to "/" */}
                    <OrgRequiredRoute exact path="/members" component={Members} />
                    <OrgRequiredRoute exact path="/settings" component={TeamSettings} />
                    <OrgRequiredRoute exact path="/settings/git" component={TeamGitIntegrations} />
                    {/* TODO: migrate other org settings pages underneath /settings prefix so we can utilize nested routes */}
                    <OrgRequiredRoute exact path="/billing" component={TeamBilling} />
                    <OrgRequiredRoute exact path="/sso" component={SSO} />

                    <Route exact path={`/projects/:projectSlug`} component={Project} />
                    <Route exact path={`/projects/:projectSlug/events`} component={Events} />
                    <Route exact path={`/projects/:projectSlug/prebuilds`} component={Prebuilds} />
                    <Route exact path={`/projects/:projectSlug/settings`} component={ProjectSettings} />
                    <Route exact path={`/projects/:projectSlug/variables`} component={ProjectVariables} />
                    <Route exact path={`/projects/:projectSlug/:prebuildId`} component={Prebuild} />
                    {/* basic redirect for old team slugs */}
                    <Route path={["/t/"]} exact>
                        <Redirect to="/projects" />
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
                    <Route path="/billing" exact>
                        <Redirect to={settingsPathBilling} />
                    </Route>
                    <Route path="/plans" exact>
                        <Redirect to={settingsPathPlans} />
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
                {startWorkspaceModalProps && !newCreateWsPage && (
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
