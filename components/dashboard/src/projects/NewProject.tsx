/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { iconForAuthProvider, openAuthorizeWindow, simplifyProviderName } from "../provider-utils";
import { AuthProviderInfo, ProviderRepository, Team, User } from "@gitpod/gitpod-protocol";
import { TeamsContext } from "../teams/teams-context";
import { useHistory, useLocation } from "react-router";
import ContextMenu, { ContextMenuEntry } from "../components/ContextMenu";
import CaretDown from "../icons/CaretDown.svg";
import Plus from "../icons/Plus.svg";
import Switch from "../icons/Switch.svg";
import NoAccess from "../icons/NoAccess.svg";
import search from "../icons/search.svg";
import moment from "moment";
import { UserContext } from "../user-context";

export default function NewProject() {
    const location = useLocation();
    const history = useHistory();
    const { teams } = useContext(TeamsContext);
    const { user } = useContext(UserContext);

    const [provider, setProvider] = useState<string>("github.com");
    const [reposInAccounts, setReposInAccounts] = useState<ProviderRepository[]>([]);
    const [repoSearchFilter, setRepoSearchFilter] = useState<string>("");
    const [selectedAccount, setSelectedAccount] = useState<string | undefined>(undefined);
    const [noOrgs, setNoOrgs] = useState<boolean>(false);
    const [showGitProviders, setShowGitProviders] = useState<boolean>(false);
    const [selectedRepo, setSelectedRepo] = useState<string | undefined>(undefined);
    const [selectedTeamOrUser, setSelectedTeamOrUser] = useState<Team | User | undefined>(undefined);

    const [showNewTeam, setShowNewTeam] = useState<boolean>(false);
    const [loaded, setLoaded] = useState<boolean>(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const teamParam = params.get("team");
        if (teamParam) {
            window.history.replaceState({}, '', window.location.pathname);
            const team = teams?.find(t => t.slug === teamParam);
            setSelectedTeamOrUser(team);
        }

        (async () => {
            updateOrgsState();
            const repos = await updateReposInAccounts();
            const first = repos[0];
            if (first) {
                setSelectedAccount(first.account);
            }
            setLoaded(true);
        })();
    }, []);

    useEffect(() => {
        if (selectedTeamOrUser && selectedRepo) {
            createProject(selectedTeamOrUser, selectedRepo);
        }
    }, [selectedTeamOrUser, selectedRepo]);

    useEffect(() => {
        if (reposInAccounts.length === 0) {
            setSelectedAccount(undefined);
        } else {
            const mostRecent = reposInAccounts.reduce((prev, current) => (prev.installationUpdatedAt || 0) > (current.installationUpdatedAt || 0) ? prev : current);
            setSelectedAccount(mostRecent.account);
        }

    }, [reposInAccounts]);

    useEffect(() => {
        setRepoSearchFilter("");
    }, [selectedAccount]);

    const isGitHub = () => provider === "github.com";

    const updateReposInAccounts = async (installationId?: string) => {
        try {
            const repos = await getGitpodService().server.getProviderRepositoriesForUser({ provider, hints: { installationId } });
            setReposInAccounts(repos);
            return repos;
        } catch (error) {
            setReposInAccounts([]);
            console.log(error);
        }
        return [];
    }

    const getToken = async (host: string) => {
        return getGitpodService().server.getToken({ host });
    }

    const updateOrgsState = async () => {
        if (isGitHub()) {
            try {
                const ghToken = await getToken(provider);
                setNoOrgs(ghToken?.scopes.includes("read:org") !== true);
            } catch {
            }
        }
    }

    const reconfigure = () => {
        openReconfigureWindow({
            account: selectedAccount,
            onSuccess: (p: { installationId: string, setupAction?: string }) => {
                updateReposInAccounts(p.installationId);
            }
        });
    }

    const grantReadOrgPermissions = async () => {
        try {
            await openAuthorizeWindow({
                host: "github.com",
                scopes: ["read:org"],
                onSuccess: () => {
                    updateReposInAccounts();
                    updateOrgsState();
                }
            })
        } catch (error) {
            console.log(error);
        }
    }

    const createProject = async (teamOrUser: Team | User, selectedRepo: string) => {
        const repo = reposInAccounts.find(r => r.account === selectedAccount && r.name === selectedRepo);
        if (!repo) {
            console.error("No repo selected!")
            return;
        }

        await getGitpodService().server.createProject({
            name: repo.name,
            cloneUrl: repo.cloneUrl,
            account: repo.account,
            provider,
            ...(User.is(teamOrUser) ? { userId: teamOrUser.id } : { teamId: teamOrUser.id }),
            appInstallationId: String(repo.installationId),
        });

        history.push(`/${User.is(teamOrUser) ? 'projects' : teamOrUser.slug}/${repo.name}/configure`);
    }

    const toSimpleName = (fullName: string) => {
        const splitted = fullName.split("/");
        if (splitted.length < 2) {
            return fullName;
        }
        return splitted.shift() && splitted.join("/");
    }

    const reposToRender = Array.from(reposInAccounts).filter(r => r.account === selectedAccount && r.name.includes(repoSearchFilter));
    const accounts = new Map<string, { avatarUrl: string }>();
    reposInAccounts.forEach(r => { if (!accounts.has(r.account)) accounts.set(r.account, { avatarUrl: r.accountAvatarUrl }) });

    const getDropDownEntries = (accounts: Map<string, { avatarUrl: string }>) => {
        const renderItemContent = (label: string, icon: string, addClasses?: string) => (<div className="w-full flex">
            <img src={icon} className="rounded-full w-6 h-6 my-auto" />
            <span className={"pl-2 text-gray-600 dark:text-gray-100 text-base " + (addClasses || "")}>{label}</span>
        </div>)
        const result: ContextMenuEntry[] = [];
        for (const [ account, props ] of accounts.entries()) {
            result.push({
                title: account,
                customContent: renderItemContent(account, props.avatarUrl, "font-semibold"),
                separator: true,
                onClick: () => setSelectedAccount(account),
            })
        }
        if (isGitHub()) {
            result.push({
                title: "Add another GitHub account",
                customContent: renderItemContent("Add GitHub Orgs or Account", Plus),
                separator: true,
                onClick: () => reconfigure(),
            })
        }
        result.push({
            title: "Select another Git Provider to continue with",
            customContent: renderItemContent("Select Git Provider", Switch),
            onClick: () => setShowGitProviders(true),
        })

        return result;
    }

    const renderSelectRepository = () => {

        const icon = selectedAccount && accounts.get(selectedAccount)?.avatarUrl;

        const renderRepos = () => (<div className="mt-10 border rounded-t-xl border-gray-100 flex-col">
            <div className="px-8 pt-8 flex flex-col space-y-2">
                <ContextMenu classes="w-full left-0 cursor-pointer" menuEntries={getDropDownEntries(accounts)}>
                    <div className="w-full">
                        <img src={icon} className="rounded-full w-6 h-6 absolute top-1/4 left-4" />
                        <input className="w-full px-12 cursor-pointer font-semibold" readOnly type="text" value={selectedAccount || ""}></input>
                        <img src={CaretDown} title="Select Account" className="filter-grayscale absolute top-1/2 right-3" />
                    </div>
                </ContextMenu>
                <div className="w-full relative ">
                    <img src={search} title="Search" className="filter-grayscale absolute top-1/3 left-3" />
                    <input className="w-96 pl-10 border-0" type="text" placeholder="Search Repositories" value={repoSearchFilter}
                        onChange={(e) => setRepoSearchFilter(e.target.value)}></input>
                </div>
            </div>
            <div className="p-6 flex-col">
                {reposToRender.length > 0 && (
                    <div className="overscroll-contain max-h-80 overflow-y-auto pr-2">
                        {reposToRender.map(r => (
                            <div key={`repo-${r.name}`} className="flex p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light transition ease-in-out group" >

                                <div className="flex-grow">
                                    <div className="text-base text-gray-900 dark:text-gray-50 font-medium rounded-xl whitespace-nowrap">{toSimpleName(r.name)}</div>
                                    <p>Updated {moment(r.updatedAt).fromNow()}</p>
                                </div>
                                    <div className="flex justify-end">
                                        <div className="h-full my-auto flex self-center opacity-0 group-hover:opacity-100">
                                            {!r.inUse ? (
                                                <button className="primary" onClick={() => setSelectedRepo(r.name)}>Select</button>
                                            ) : (
                                                <p className="my-auto">already taken</p>
                                            )}
                                        </div>
                                    </div>
                            </div>
                        ))}
                    </div>
                )}
                {reposToRender.length === 0 && (
                    <p className="text-center ">not found</p>
                )}
            </div>

            <div className="px-3 pt-3 bg-gray-100">
                <div className="text-gray-500 text-center">
                    Repository not found? <a href="javascript:void(0)" onClick={e => reconfigure()} className="text-gray-400 underline underline-thickness-thin underline-offset-small hover:text-gray-600">Reconfigure</a>
                </div>
                {isGitHub() && noOrgs && (
                    <div className="text-gray-500 mx-auto text-center">
                        Missing organizations? <a href="javascript:void(0)" onClick={e => grantReadOrgPermissions()} className="text-gray-400 underline underline-thickness-thin underline-offset-small hover:text-gray-600">Grant permissions</a>
                    </div>
                )}
            </div>
            <div className="h-3 border rounded-b-xl border-gray-100 bg-gray-100"></div>
        </div>);

        const renderEmptyState = () => (<div className="mt-8 border rounded-xl border-gray-100 dark:border-gray-700 flex-col">
            <div>
                <div className="px-12 py-16 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <img src={NoAccess} title="No Access" className="m-auto mb-4" />
                    <h3 className="mb-2 text-gray-600 dark:text-gray-400">
                        No Access
                    </h3>
                    <span className="dark:text-gray-500">
                        Authorize GitHub (github.com) or select a different account.
                    </span>
                    <br/>
                    <button className="mt-6" onClick={() => reconfigure()}>Authorize Provider</button>
                </div>
            </div>
        </div>)

        const empty = reposInAccounts.length === 0;

        const onGitProviderSeleted = (host: string) => {
            setShowGitProviders(false);
            setProvider(host);
        }

        return (<>
            {(loaded && empty) ? renderEmptyState() : (showGitProviders ? (<GitProviders onHostSelected={onGitProviderSeleted} />) : renderRepos())}
        </>)
    };

    const renderSelectTeam = () => {
        const userFullName = user?.fullName || user?.name || '...';
        const teamsToRender = teams || [];
        return (<>
            <h3 className="pb-2 mt-8">Select Team</h3>
            <h4 className="pb-2">Adding <strong>{selectedRepo}</strong></h4>

            <div className="mt-8 border rounded-xl border-gray-100 flex-col" >
                <div key={`user-${userFullName}`} className={`w-96 border-b px-8 py-4 flex space-x-2 justify-between dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light transition ease-in-out group`}>
                    <div className="w-8/12 m-auto overflow-ellipsis truncate">{userFullName}</div>
                    <div className="w-4/12 flex justify-end">
                        <div className="flex self-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md cursor-pointer opacity-0 group-hover:opacity-100">
                            <button className="primary py-1" onClick={() => setSelectedTeamOrUser(user)}>Select</button>
                        </div>
                    </div>
                </div>
                {teamsToRender.map((t) => (
                    <div key={`team-${t.name}`} className={`w-96 border-b px-8 py-4 flex space-x-2 justify-between dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light transition ease-in-out group`}>
                        <div className="w-8/12 m-auto overflow-ellipsis truncate">{t.name}</div>
                        <div className="w-4/12 flex justify-end">
                            <div className="flex self-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md cursor-pointer opacity-0 group-hover:opacity-100">
                                <button className="primary py-1" onClick={() => setSelectedTeamOrUser(t)}>Select</button>
                            </div>
                        </div>
                    </div>
                ))}
                <div className="w-96 py-4 px-8 flex text-gray-500">
                    <div className="w-full relative" onClick={() => setShowNewTeam(!showNewTeam)}>
                        <div className="space-x-2">New Team</div>
                        {teamsToRender.length > 0 && (
                            <img src={CaretDown} title="Select Account" className={`${showNewTeam ? "transform rotate-180" : ""} filter-grayscale absolute top-1/2 right-3 cursor-pointer`} />
                        )}
                    </div>
                </div>
                {(showNewTeam || teamsToRender.length === 0) && (
                    <NewTeam className="w-96 px-8 pb-8" onSuccess={(t) => setSelectedTeamOrUser(t)} />
                )}
            </div>
        </>)
    };

    return (<div className="flex flex-col w-96 mt-24 mx-auto items-center">
        <h1>New Project</h1>
        <p className="text-gray-500 text-center text-base">Select a git repository.</p>

        {!selectedRepo && renderSelectRepository()}

        {selectedRepo && !selectedTeamOrUser && renderSelectTeam()}

        {selectedRepo && selectedTeamOrUser && (<div></div>)}

    </div>);

}

function GitProviders(props: {
    onHostSelected: (host: string) => void
}) {
    const [authProviders, setAuthProviders] = useState<AuthProviderInfo[]>([]);

    useEffect(() => {
        (async () => {
            const providers = await getGitpodService().server.getAuthProviders();
            setAuthProviders(providers.filter(p => ["github.com", "gitlab.com"].includes(p.host)));
        })();
    }, []);

    const selectProvider = async (ap: AuthProviderInfo) => {
        const token = await getGitpodService().server.getToken({ host: ap.host });
        if (token) {
            props.onHostSelected(ap.host);
            return;
        }
        await openAuthorizeWindow({
            host: ap.host,
            scopes: ap.requirements?.default,
            onSuccess: () => {
                props.onHostSelected(ap.host);
            },
            onError: (error) => {
                console.log(error);
            }
        });
    }

    return (
        <div className="mt-8 border rounded-t-xl border-gray-100 flex-col">
            <div className="p-6 p-b-0">
                <div className="text-center text-gray-500">
                    Select a Git provider first and continue with your repositories.
                </div>
                <div className="mt-6 flex flex-col space-y-3 items-center pb-8">
                    {authProviders.map(ap => {
                        return (
                            <button key={"button" + ap.host} className="btn-login flex-none w-56 h-10 p-0 inline-flex" onClick={() => selectProvider(ap)}>
                                {iconForAuthProvider(ap.authProviderType)}
                                <span className="pt-2 pb-2 mr-3 text-sm my-auto font-medium truncate overflow-ellipsis">Continue with {simplifyProviderName(ap.host)}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    )
}

function NewTeam(props: {
    onSuccess: (team: Team) => void,
    className?: string,
}) {
    const { setTeams } = useContext(TeamsContext);

    const [teamName, setTeamName] = useState<string | undefined>();
    const [error, setError] = useState<string | undefined>();

    const onNewTeam = async () => {
        if (!teamName) {
            return;
        }
        try {
            const team = await getGitpodService().server.createTeam(teamName);
            setTeams(await getGitpodService().server.getTeams());
            props.onSuccess(team);
        } catch (error) {
            console.error(error);
            setError(error?.message || "Failed to create new team!");
        }
    }

    const onTeamNameChanged = (name: string) => {
        setTeamName(name);
        setError(undefined);
    }

    return (
        <div className={props.className}>
            <div className="flex flex-row space-x-2">
                <input type="text" className="py-1 flex-grow w-36" name="new-team-inline" value={teamName} placeholder="team-name" onChange={(e) => onTeamNameChanged(e.target.value)} />
                <button key={`new-team-inline-create`} disabled={!teamName} onClick={() => onNewTeam()}>Create Team</button>
            </div>
            {error && <p className="text-gitpod-red">{error}</p>}
        </div>
    )
}

async function openReconfigureWindow(params: { account?: string, onSuccess: (p: any) => void }) {
    const { account, onSuccess } = params;
    const state = btoa(JSON.stringify({ from: "/reconfigure", next: "/new" }));
    const url = gitpodHostUrl.withApi({
        pathname: '/apps/github/reconfigure',
        search: `account=${account}&state=${encodeURIComponent(state)}`
    }).toString();

    const width = 800;
    const height = 800;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    // Optimistically assume that the new window was opened.
    window.open(url, "gitpod-github-window", `width=${width},height=${height},top=${top},left=${left}status=yes,scrollbars=yes,resizable=yes`);

    const eventListener = (event: MessageEvent) => {
        // todo: check event.origin

        const killWindow = () => {
            window.removeEventListener("message", eventListener);

            if (event.source && "close" in event.source && event.source.close) {
                console.log(`Received Window Result. Closing Window.`);
                event.source.close();
            }
        }

        if (typeof event.data === "string" && event.data.startsWith("payload:")) {
            killWindow();
            try {
                let payload: { installationId: string, setupAction?: string } = JSON.parse(atob(event.data.substring("payload:".length)));
                onSuccess && onSuccess(payload);
            } catch (error) {
                console.log(error);
            }
        }
        if (typeof event.data === "string" && event.data.startsWith("error:")) {
            let error: string | { error: string, description?: string } = atob(event.data.substring("error:".length));
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