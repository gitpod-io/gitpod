/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo, Project } from "@gitpod/gitpod-protocol";
import { FC, useCallback, useContext, useEffect, useMemo, useState } from "react";
import ErrorMessage from "../components/ErrorMessage";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import exclamation from "../images/exclamation.svg";
import { iconForAuthProvider, openAuthorizeWindow, simplifyProviderName } from "../provider-utils";
import { getGitpodService } from "../service/service";
import { UserContext, useCurrentUser } from "../user-context";
import { Heading1, Subheading } from "../components/typography/headings";
import { useAuthProviders } from "../data/auth-providers/auth-provider-query";
import { AuthorizeGit, useNeedsGitAuthorization } from "../components/AuthorizeGit";
import { NewProjectRepoSelection } from "./new-project/NewProjectRepoSelection";
import { NewProjectSubheading } from "./new-project/NewProjectSubheading";
import { Button } from "../components/Button";

export default function NewProject() {
    const currentTeam = useCurrentOrg()?.data;
    const user = useCurrentUser();
    const authProviders = useAuthProviders();

    // State this component manages
    const [selectedProviderHost, setSelectedProviderHost] = useState<string>();
    const [project, setProject] = useState<Project>();

    // Defaults selectedProviderHost if not set yet
    useEffect(() => {
        if (user && authProviders.data && selectedProviderHost === undefined) {
            for (let i = user.identities.length - 1; i >= 0; i--) {
                const candidate = user.identities[i];
                if (candidate) {
                    const authProvider = authProviders.data.find(
                        (ap) => ap.authProviderId === candidate.authProviderId,
                    );
                    const host = authProvider?.host;
                    if (host) {
                        setSelectedProviderHost(host);
                        break;
                    }
                }
            }
        }
    }, [user, authProviders.data, selectedProviderHost]);

    const onNewWorkspace = useCallback(async () => {
        const redirectToNewWorkspace = () => {
            // instead of `history.push` we want forcibly to redirect here in order to avoid a following redirect from `/` -> `/projects` (cf. App.tsx)
            const url = new URL(window.location.toString());
            url.pathname = "/";
            url.hash = project?.cloneUrl!;
            window.location.href = url.toString();
        };
        redirectToNewWorkspace();
    }, [project?.cloneUrl]);

    // Show that the project was created
    if (project) {
        return (
            <div className="flex flex-col w-96 mt-24 mx-auto items-center">
                <Heading1>Project Created</Heading1>
                <Subheading className="mt-2 text-center">
                    Created{" "}
                    <a className="gp-link" href={`/projects/${Project.slug(project!)}`}>
                        {project.name}
                    </a>{" "}
                    {!currentTeam ? (
                        ""
                    ) : (
                        <span>
                            {" "}
                            in organization{" "}
                            <a className="gp-link" href={`/projects`}>
                                {currentTeam?.name}
                            </a>
                        </span>
                    )}
                </Subheading>

                <div className="mt-12">
                    <Button onClick={onNewWorkspace}>New Workspace</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-96 mt-24 mx-auto items-center">
            <Heading1>New Project</Heading1>
            <NewProjectSubheading />

            <NewProjectMainContent
                selectedProviderHost={selectedProviderHost}
                onProviderSelected={setSelectedProviderHost}
                onProjectCreated={setProject}
            />
        </div>
    );
}

type NewProjectMainContentProps = {
    selectedProviderHost?: string;
    onProviderSelected: (host: string, updateUser?: boolean) => void;
    onProjectCreated: (project: Project) => void;
};
const NewProjectMainContent: FC<NewProjectMainContentProps> = ({
    selectedProviderHost,
    onProviderSelected,
    onProjectCreated,
}) => {
    const { setUser } = useContext(UserContext);
    const authProviders = useAuthProviders();
    const needsGitAuth = useNeedsGitAuthorization();
    const [showGitProviders, setShowGitProviders] = useState(false);

    const onGitProviderSeleted = useCallback(
        async (host: string, updateUser?: boolean) => {
            // TODO: Can we push this down into where sends updateUser=true?
            if (updateUser) {
                setUser(await getGitpodService().server.getLoggedInUser());
            }
            setShowGitProviders(false);
            onProviderSelected(host);
        },
        [onProviderSelected, setUser],
    );

    if (needsGitAuth) {
        return <AuthorizeGit />;
    }

    if (showGitProviders) {
        return <GitProviders onHostSelected={onGitProviderSeleted} authProviders={authProviders.data || []} />;
    }

    return (
        <NewProjectRepoSelection
            selectedProviderHost={selectedProviderHost}
            onProjectCreated={onProjectCreated}
            onChangeGitProvider={() => setShowGitProviders(true)}
        />
    );
};

const GitProviders: FC<{
    authProviders: AuthProviderInfo[];
    onHostSelected: (host: string, updateUser?: boolean) => void;
}> = ({ authProviders, onHostSelected }) => {
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    const selectProvider = useCallback(
        async (ap: AuthProviderInfo) => {
            setErrorMessage(undefined);

            const token = await getGitpodService().server.getToken({ host: ap.host });
            if (token && !(ap.authProviderType === "GitHub" && !token.scopes.includes("repo"))) {
                onHostSelected(ap.host);
                return;
            }
            await openAuthorizeWindow({
                host: ap.host,
                scopes: ap.authProviderType === "GitHub" ? ["repo"] : ap.requirements?.default,
                onSuccess: async () => {
                    onHostSelected(ap.host, true);
                },
                onError: (payload) => {
                    let errorMessage: string;
                    if (typeof payload === "string") {
                        errorMessage = payload;
                    } else {
                        errorMessage = payload.description ? payload.description : `Error: ${payload.error}`;
                        if (payload.error === "email_taken") {
                            errorMessage = `Email address already used in another account. Please log in with ${
                                (payload as any).host
                            }.`;
                        }
                    }
                    setErrorMessage(errorMessage);
                },
            });
        },
        [onHostSelected],
    );

    const filteredProviders = useMemo(
        () =>
            authProviders.filter(
                (p) =>
                    p.authProviderType === "GitHub" ||
                    p.host === "bitbucket.org" ||
                    p.authProviderType === "GitLab" ||
                    p.authProviderType === "BitbucketServer",
            ),
        [authProviders],
    );

    return (
        <div className="mt-8 border rounded-t-xl border-gray-100 dark:border-gray-800 flex-col">
            <div className="p-6 p-b-0">
                <div className="text-center text-gray-500">
                    Select a Git provider first and continue with your repositories.
                </div>
                <div className="mt-6 flex flex-col space-y-3 items-center pb-8">
                    {filteredProviders.map((ap) => {
                        return (
                            <button
                                key={ap.host}
                                className="btn-login flex-none w-56 h-10 p-0 inline-flex"
                                onClick={() => selectProvider(ap)}
                            >
                                {iconForAuthProvider(ap.authProviderType)}
                                <span className="pt-2 pb-2 mr-3 text-sm my-auto font-medium truncate overflow-ellipsis">
                                    Continue with {simplifyProviderName(ap.host)}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {errorMessage && <ErrorMessage imgSrc={exclamation} message={errorMessage} />}
            </div>
        </div>
    );
};
