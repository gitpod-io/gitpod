/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo, Project, ProviderRepository, Team } from "@gitpod/gitpod-protocol";
import dayjs from "dayjs";
import { useCallback, useContext, useEffect, useState } from "react";
import { trackEvent } from "../Analytics";
import ContextMenu, { ContextMenuEntry } from "../components/ContextMenu";
import ErrorMessage from "../components/ErrorMessage";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useRefreshProjects } from "../data/projects/list-projects-query";
import CaretDown from "../icons/CaretDown.svg";
import Plus from "../icons/Plus.svg";
import search from "../icons/search.svg";
import Spinner from "../icons/Spinner.svg";
import Switch from "../icons/Switch.svg";
import exclamation from "../images/exclamation.svg";
import { iconForAuthProvider, openAuthorizeWindow, simplifyProviderName } from "../provider-utils";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { UserContext } from "../user-context";
import { projectsPathNew } from "./projects.routes";
import { Heading1, Subheading } from "../components/typography/headings";
import { useAuthProviders } from "../data/auth-providers/auth-provider-query";
import { AuthorizeGit, useNeedsGitAuthorization } from "../components/AuthorizeGit";

export default function NewProject() {
    const currentTeam = useCurrentOrg()?.data;
    const { user, setUser } = useContext(UserContext);
    const refreshProjects = useRefreshProjects();
    const needsGitAuth = useNeedsGitAuthorization();

    const [selectedProviderHost, setSelectedProviderHost] = useState<string | undefined>();
    const [reposInAccounts, setReposInAccounts] = useState<ProviderRepository[]>([]);
    const [repoSearchFilter, setRepoSearchFilter] = useState<string>("");
    const [selectedAccount, setSelectedAccount] = useState<string | undefined>(undefined);
    const [showGitProviders, setShowGitProviders] = useState<boolean>(false);
    const [selectedRepo, setSelectedRepo] = useState<ProviderRepository | undefined>(undefined);
    const [loaded, setLoaded] = useState<boolean>(false);

    const [project, setProject] = useState<Project | undefined>();

    const authProviders = useAuthProviders();
    const [isGitHubAppEnabled, setIsGitHubAppEnabled] = useState<boolean>();
    const [isGitHubWebhooksUnauthorized, setIsGitHubWebhooksUnauthorized] = useState<boolean>();

    useEffect(() => {
        const { server } = getGitpodService();
        Promise.all([server.isGitHubAppEnabled().then((v) => () => setIsGitHubAppEnabled(v))]).then((setters) =>
            setters.forEach((s) => s()),
        );
    }, []);

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

    useEffect(() => {
        setIsGitHubWebhooksUnauthorized(false);
        if (!authProviders.data || !selectedProviderHost || isGitHubAppEnabled) {
            return;
        }
        const ap = authProviders.data?.find((ap) => ap.host === selectedProviderHost);
        if (!ap || ap.authProviderType !== "GitHub") {
            return;
        }
        getGitpodService()
            .server.getToken({ host: ap.host })
            .then((token) => {
                if (!token || !token.scopes.includes("repo")) {
                    setIsGitHubWebhooksUnauthorized(true);
                }
            });
    }, [authProviders.data, isGitHubAppEnabled, selectedProviderHost]);

    useEffect(() => {
        if (selectedRepo && user && currentTeam) {
            createProject(currentTeam, selectedRepo);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRepo, currentTeam, user]);

    useEffect(() => {
        if (reposInAccounts.length === 0) {
            setSelectedAccount(undefined);
        } else {
            const first = reposInAccounts[0];
            if (!!first.installationUpdatedAt) {
                const mostRecent = reposInAccounts.reduce((prev, current) =>
                    (prev.installationUpdatedAt || 0) > (current.installationUpdatedAt || 0) ? prev : current,
                );
                setSelectedAccount(mostRecent.account);
            } else {
                setSelectedAccount(first.account);
            }
        }
    }, [reposInAccounts]);

    useEffect(() => {
        setRepoSearchFilter("");
    }, [selectedAccount]);

    useEffect(() => {
        if (!selectedProviderHost) {
            return;
        }
        (async () => {
            await updateReposInAccounts();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProviderHost]);

    useEffect(() => {
        if (project) {
            getGitpodService().server.triggerPrebuild(project.id, null);
        }
    }, [project]);

    const isGitHub = () => selectedProviderHost === "github.com";

    const updateReposInAccounts = async (installationId?: string) => {
        setLoaded(false);
        setReposInAccounts([]);
        if (!selectedProviderHost) {
            return [];
        }
        try {
            const repos = await getGitpodService().server.getProviderRepositoriesForUser({
                provider: selectedProviderHost,
                hints: { installationId },
            });
            setReposInAccounts(repos);
            setLoaded(true);
            return repos;
        } catch (error) {
            console.log(error);
        }
        return [];
    };

    const reconfigure = () => {
        openReconfigureWindow({
            account: selectedAccount,
            onSuccess: (p: { installationId: string; setupAction?: string }) => {
                updateReposInAccounts(p.installationId);
                trackEvent("organisation_authorised", {
                    installation_id: p.installationId,
                    setup_action: p.setupAction,
                });
            },
        });
    };

    const authorize = () => {
        const ap = authProviders.data?.find((ap) => ap.host === selectedProviderHost);
        if (!ap) {
            return;
        }
        openAuthorizeWindow({
            host: ap.host,
            scopes: ap.authProviderType === "GitHub" ? ["repo"] : ap.requirements?.default,
            onSuccess: async () => {
                if (ap.authProviderType === "GitHub") {
                    setIsGitHubWebhooksUnauthorized(false);
                }
            },
            onError: (payload) => {
                console.error("Authorization failed", selectedProviderHost, payload);
            },
        });
    };

    // TODO: Look into making this a react-query mutation
    const createProject = useCallback(
        async (team: Team, repo: ProviderRepository) => {
            if (!selectedProviderHost) {
                return;
            }
            const repoSlug = repo.path || repo.name;

            try {
                const project = await getGitpodService().server.createProject({
                    name: repo.name,
                    slug: repoSlug,
                    cloneUrl: repo.cloneUrl,
                    teamId: team.id,
                    appInstallationId: String(repo.installationId),
                });

                // TODO: After converting this to a mutation, we can handle invalidating/updating the query in a side effect
                refreshProjects(project.teamId);

                setProject(project);
            } catch (error) {
                const message = (error && error?.message) || "Failed to create new project.";
                window.alert(message);
            }
        },
        [refreshProjects, selectedProviderHost],
    );

    const toSimpleName = (fullName: string) => {
        const splitted = fullName.split("/");
        if (splitted.length < 2) {
            return fullName;
        }
        return splitted.shift() && splitted.join("/");
    };

    const accounts = new Map<string, { avatarUrl: string }>();
    reposInAccounts.forEach((r) => {
        if (!accounts.has(r.account)) {
            accounts.set(r.account, { avatarUrl: r.accountAvatarUrl });
        } else if (!accounts.get(r.account)?.avatarUrl && r.accountAvatarUrl) {
            accounts.get(r.account)!.avatarUrl = r.accountAvatarUrl;
        }
    });

    const getDropDownEntries = (accounts: Map<string, { avatarUrl: string }>) => {
        const renderItemContent = (label: string, icon: string, addClasses?: string) => (
            <div className="w-full flex">
                <img src={icon} className="rounded-full w-6 h-6 my-auto" alt="icon" />
                <span className={"pl-2 text-gray-600 dark:text-gray-100 text-base " + (addClasses || "")}>{label}</span>
            </div>
        );
        const result: ContextMenuEntry[] = [];

        if (!selectedAccount && user && user.name && user.avatarUrl) {
            result.push({
                title: "user",
                customContent: renderItemContent(user?.name, user?.avatarUrl),
                separator: true,
            });
        }
        for (const [account, props] of accounts.entries()) {
            result.push({
                title: account,
                customContent: renderItemContent(account, props.avatarUrl, "font-semibold"),
                separator: true,
                onClick: () => setSelectedAccount(account),
            });
        }
        if (isGitHub() && isGitHubAppEnabled) {
            result.push({
                title: "Add another GitHub account",
                customContent: renderItemContent("Add GitHub Orgs or Account", Plus),
                separator: true,
                onClick: () => reconfigure(),
            });
        }
        result.push({
            title: "Select another Git Provider to continue with",
            customContent: renderItemContent("Select Git Provider", Switch),
            onClick: () => setShowGitProviders(true),
        });

        return result;
    };

    const renderSelectRepository = () => {
        // Don't list GitHub projects if we cannot install webhooks on them (project creation would eventually fail)
        const noReposAvailable = reposInAccounts.length === 0 || isGitHubWebhooksUnauthorized;
        const filteredRepos = isGitHubWebhooksUnauthorized
            ? []
            : Array.from(reposInAccounts).filter(
                  (r) =>
                      r.account === selectedAccount &&
                      `${r.name}`.toLowerCase().includes(repoSearchFilter.toLowerCase().trim()),
              );
        const icon = selectedAccount && accounts.get(selectedAccount)?.avatarUrl;

        const showSearchInput = !!repoSearchFilter || filteredRepos.length > 0;

        const userLink = (r: ProviderRepository) => {
            return `https://${new URL(r.cloneUrl).host}/${r.inUse?.userName}`;
        };

        const projectText = () => {
            return (
                <Subheading className="text-center">
                    Projects allow you to manage prebuilds and workspaces for your repository.{" "}
                    <a
                        href="https://www.gitpod.io/docs/configure/projects"
                        target="_blank"
                        rel="noreferrer"
                        className="gp-link"
                    >
                        Learn more
                    </a>
                </Subheading>
            );
        };

        const renderRepos = () => (
            <>
                {projectText()}
                <p className="text-gray-500 text-center text-base mt-12">
                    {loaded && noReposAvailable ? "Select account on " : "Select a Git repository on "}
                    <b>{selectedProviderHost}</b> (
                    <button className="gp-link cursor-pointer" onClick={() => setShowGitProviders(true)}>
                        change
                    </button>
                    )
                </p>
                <div className={`mt-2 flex-col ${noReposAvailable && isGitHub() ? "w-96" : ""}`}>
                    <div className="px-8 flex flex-col space-y-2" data-analytics='{"label":"Identity"}'>
                        <ContextMenu
                            customClasses="w-full left-0 cursor-pointer"
                            menuEntries={getDropDownEntries(accounts)}
                        >
                            <div className="w-full">
                                {!selectedAccount && user && user.name && user.avatarUrl && (
                                    <>
                                        <img
                                            src={user?.avatarUrl}
                                            className="rounded-full w-6 h-6 absolute my-2.5 left-3"
                                            alt="user avatar"
                                        />
                                        <input
                                            className="w-full px-12 cursor-pointer font-semibold"
                                            readOnly
                                            type="text"
                                            value={user?.name}
                                        ></input>
                                    </>
                                )}
                                {selectedAccount && (
                                    <>
                                        <img
                                            src={icon ? icon : ""}
                                            className="rounded-full w-6 h-6 absolute my-2.5 left-3"
                                            alt="icon"
                                        />
                                        <input
                                            className="w-full px-12 cursor-pointer font-semibold"
                                            readOnly
                                            type="text"
                                            value={selectedAccount}
                                        ></input>
                                    </>
                                )}
                                <img
                                    src={CaretDown}
                                    title="Select Account"
                                    className="filter-grayscale absolute top-1/2 right-3"
                                    alt="down caret icon"
                                />
                            </div>
                        </ContextMenu>
                        {showSearchInput && (
                            <div className="w-full relative h-10 my-auto">
                                <img
                                    src={search}
                                    title="Search"
                                    className="filter-grayscale absolute top-1/3 left-3"
                                    alt="search icon"
                                />
                                <input
                                    className="w-96 pl-10 border-0"
                                    type="search"
                                    placeholder="Search Repositories"
                                    value={repoSearchFilter}
                                    onChange={(e) => setRepoSearchFilter(e.target.value)}
                                ></input>
                            </div>
                        )}
                    </div>
                    <div className="p-6 flex-col">
                        {filteredRepos.length > 0 && (
                            <div className="overscroll-contain max-h-80 overflow-y-auto pr-2">
                                {filteredRepos.map((r, index) => (
                                    <div
                                        key={`repo-${index}-${r.account}-${r.name}`}
                                        className="flex p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light transition ease-in-out group"
                                        title={r.cloneUrl}
                                    >
                                        <div className="flex-grow">
                                            <div
                                                className={
                                                    "text-base text-gray-900 dark:text-gray-50 font-medium rounded-xl whitespace-nowrap" +
                                                    (r.inUse ? " text-gray-400 dark:text-gray-500" : "text-gray-700")
                                                }
                                            >
                                                {toSimpleName(r.name)}
                                            </div>
                                            {r.updatedAt && <p>Updated {dayjs(r.updatedAt).fromNow()}</p>}
                                        </div>
                                        <div className="flex justify-end">
                                            <div className="h-full my-auto flex self-center opacity-0 group-hover:opacity-100 items-center mr-2 text-right">
                                                {!r.inUse ? (
                                                    <button className="primary" onClick={() => setSelectedRepo(r)}>
                                                        Select
                                                    </button>
                                                ) : (
                                                    <p className="text-gray-500 font-medium">
                                                        <a rel="noopener" className="gp-link" href={userLink(r)}>
                                                            @{r.inUse.userName}
                                                        </a>{" "}
                                                        already
                                                        <br />
                                                        added this repo
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {!noReposAvailable && filteredRepos.length === 0 && <p className="text-center">No Results</p>}
                        {loaded && noReposAvailable && isGitHub() && (
                            <div>
                                <div className="px-12 py-20 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                    <span className="dark:text-gray-400">
                                        Additional authorization is required for Gitpod to watch your GitHub
                                        repositories and trigger prebuilds.
                                    </span>
                                    <br />
                                    {isGitHubWebhooksUnauthorized ? (
                                        <button className="mt-6" onClick={() => authorize()}>
                                            Authorize GitHub
                                        </button>
                                    ) : (
                                        <button className="mt-6" onClick={() => reconfigure()}>
                                            Configure Gitpod App
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {reposInAccounts.length > 0 && isGitHub() && isGitHubAppEnabled && (
                    <div>
                        <div className="text-gray-500 text-center w-96 mx-8">
                            Repository not found?{" "}
                            <button
                                onClick={(e) => reconfigure()}
                                className="gp-link text-gray-400 underline underline-thickness-thin underline-offset-small hover:text-gray-600"
                            >
                                Reconfigure
                            </button>
                        </div>
                    </div>
                )}
            </>
        );

        const renderLoadingState = () => (
            <div>
                {projectText()}
                <div className="mt-8 border rounded-xl border-gray-100 dark:border-gray-700 flex-col">
                    <div>
                        <div className="px-12 py-16 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl w-96 h-h96 flex items-center justify-center">
                            <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm">
                                <img className="h-4 w-4 animate-spin" src={Spinner} alt="loading spinner" />
                                <span>Fetching repositories...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );

        const onGitProviderSeleted = async (host: string, updateUser?: boolean) => {
            if (updateUser) {
                setUser(await getGitpodService().server.getLoggedInUser());
            }
            setShowGitProviders(false);
            setSelectedProviderHost(host);
        };
        if (needsGitAuth) {
            return <AuthorizeGit />;
        }

        if (!loaded) {
            return renderLoadingState();
        }

        if (showGitProviders) {
            return <GitProviders onHostSelected={onGitProviderSeleted} authProviders={authProviders.data || []} />;
        }

        return renderRepos();
    };

    const onNewWorkspace = async () => {
        const redirectToNewWorkspace = () => {
            // instead of `history.push` we want forcibly to redirect here in order to avoid a following redirect from `/` -> `/projects` (cf. App.tsx)
            const url = new URL(window.location.toString());
            url.pathname = "/";
            url.hash = project?.cloneUrl!;
            window.location.href = url.toString();
        };
        redirectToNewWorkspace();
    };

    if (!project) {
        return (
            <div className="flex flex-col w-96 mt-24 mx-auto items-center">
                <Heading1>New Project</Heading1>

                {!selectedRepo && renderSelectRepository()}
            </div>
        );
    } else {
        const projectLink = `/projects/${Project.slug(project!)}`;
        const location = !currentTeam ? (
            ""
        ) : (
            <span>
                {" "}
                in organization{" "}
                <a className="gp-link" href={`/projects`}>
                    {currentTeam?.name}
                </a>
            </span>
        );

        return (
            <div className="flex flex-col w-96 mt-24 mx-auto items-center">
                <Heading1>Project Created</Heading1>

                <Subheading className="mt-2 text-center">
                    Created{" "}
                    <a className="gp-link" href={projectLink}>
                        {project.name}
                    </a>{" "}
                    {location}
                </Subheading>

                <div className="mt-12">
                    <button onClick={onNewWorkspace}>New Workspace</button>
                </div>
            </div>
        );
    }
}

function GitProviders(props: {
    authProviders: AuthProviderInfo[];
    onHostSelected: (host: string, updateUser?: boolean) => void;
}) {
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    const selectProvider = async (ap: AuthProviderInfo) => {
        setErrorMessage(undefined);

        const token = await getGitpodService().server.getToken({ host: ap.host });
        if (token && !(ap.authProviderType === "GitHub" && !token.scopes.includes("repo"))) {
            props.onHostSelected(ap.host);
            return;
        }
        await openAuthorizeWindow({
            host: ap.host,
            scopes: ap.authProviderType === "GitHub" ? ["repo"] : ap.requirements?.default,
            onSuccess: async () => {
                props.onHostSelected(ap.host, true);
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
    };

    const filteredProviders = () =>
        props.authProviders.filter(
            (p) =>
                p.authProviderType === "GitHub" ||
                p.host === "bitbucket.org" ||
                p.authProviderType === "GitLab" ||
                p.authProviderType === "BitbucketServer",
        );

    return (
        <div className="mt-8 border rounded-t-xl border-gray-100 dark:border-gray-800 flex-col">
            <div className="p-6 p-b-0">
                <div className="text-center text-gray-500">
                    Select a Git provider first and continue with your repositories.
                </div>
                <div className="mt-6 flex flex-col space-y-3 items-center pb-8">
                    {filteredProviders().map((ap) => {
                        return (
                            <button
                                key={"button" + ap.host}
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
}

async function openReconfigureWindow(params: { account?: string; onSuccess: (p: any) => void }) {
    const { account, onSuccess } = params;
    const state = btoa(JSON.stringify({ from: "/reconfigure", next: projectsPathNew }));
    const url = gitpodHostUrl
        .withApi({
            pathname: "/apps/github/reconfigure",
            search: `account=${account}&state=${encodeURIComponent(state)}`,
        })
        .toString();

    const width = 800;
    const height = 800;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // Optimistically assume that the new window was opened.
    window.open(
        url,
        "gitpod-github-window",
        `width=${width},height=${height},top=${top},left=${left}status=yes,scrollbars=yes,resizable=yes`,
    );

    const eventListener = (event: MessageEvent) => {
        // todo: check event.origin

        const killWindow = () => {
            window.removeEventListener("message", eventListener);

            if (event.source && "close" in event.source && event.source.close) {
                console.log(`Received Window Result. Closing Window.`);
                event.source.close();
            }
        };

        if (typeof event.data === "string" && event.data.startsWith("payload:")) {
            killWindow();
            try {
                let payload: { installationId: string; setupAction?: string } = JSON.parse(
                    atob(event.data.substring("payload:".length)),
                );
                onSuccess && onSuccess(payload);
            } catch (error) {
                console.log(error);
            }
        }
        if (typeof event.data === "string" && event.data.startsWith("error:")) {
            let error: string | { error: string; description?: string } = atob(event.data.substring("error:".length));
            try {
                const payload = JSON.parse(error);
                if (typeof payload === "object" && payload.error) {
                    error = { error: payload.error, description: payload.description };
                }
            } catch (error) {
                console.log(error);
            }

            killWindow();
            // onError && onError(error);
        }
    };
    window.addEventListener("message", eventListener);
}
