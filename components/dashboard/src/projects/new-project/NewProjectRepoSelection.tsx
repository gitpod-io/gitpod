/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo, Project } from "@gitpod/gitpod-protocol";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useAreGithubWebhooksUnauthorized, useIsGithubAppEnabled } from "../../data/git-providers/github-queries";
import { LinkButton } from "../../components/LinkButton";
import Spinner from "../../icons/Spinner.svg";
import { trackEvent } from "../../Analytics";
import { NewProjectSearchInput } from "./NewProjectSearchInput";
import { NewProjectAccountSelector } from "./NewProjectAccountSelector";
import { NewProjectRepoList } from "./NewProjectRepoList";
import { CreateProjectArgs, useCreateProject } from "../../data/projects/create-project-mutation";
import { NewProjectAuthRequired } from "./NewProjectAuthRequired";
import { useToast } from "../../components/toasts/Toasts";
import { useProviderRepositoriesForUser } from "../../data/git-providers/provider-repositories-query";
import { openReconfigureWindow } from "./reconfigure-github";
import { NewProjectCreateFromURL } from "./NewProjectCreateFromURL";
import { useStateWithDebounce } from "../../hooks/use-state-with-debounce";

type Props = {
    selectedProvider?: AuthProviderInfo;
    onProjectCreated: (project: Project) => void;
    onChangeGitProvider: () => void;
};
export const NewProjectRepoSelection: FC<Props> = ({ selectedProvider, onProjectCreated, onChangeGitProvider }) => {
    const { toast } = useToast();
    const { data: isGitHubAppEnabled } = useIsGithubAppEnabled();
    const areGitHubWebhooksUnauthorized = useAreGithubWebhooksUnauthorized(selectedProvider?.host ?? "");
    const createProject = useCreateProject();

    // Component state managed by this component
    const [selectedAccount, setSelectedAccount] = useState<string>();
    const [repoSearchFilter, setRepoSearchFilter, debouncedRepoSearchFilter] = useStateWithDebounce("");
    const [installationId, setInstallationId] = useState<string>();

    // Main query for listing repos given the current state
    const { data: reposInAccounts, isLoading } = useProviderRepositoriesForUser({
        providerHost: selectedProvider?.host ?? "",
        installationId,
        search: debouncedRepoSearchFilter,
    });

    // Wrap setting selected account so we can clear the repo search filter at the same time
    const setSelectedAccountAndClearSearch = useCallback(
        (account?: string) => {
            setSelectedAccount(account);
            setRepoSearchFilter("");
        },
        [setRepoSearchFilter],
    );

    // Memoized & derived values
    const noReposAvailable = !!(reposInAccounts?.length === 0 || areGitHubWebhooksUnauthorized);
    const isGitHub = selectedProvider?.host === "github.com";
    const isBitbucketServer = selectedProvider?.authProviderType === "BitbucketServer";

    const accounts = useMemo(() => {
        const accounts = new Map<string, { avatarUrl: string }>();

        reposInAccounts?.forEach((r) => {
            if (!accounts.has(r.account)) {
                accounts.set(r.account, { avatarUrl: r.accountAvatarUrl });
            } else if (!accounts.get(r.account)?.avatarUrl && r.accountAvatarUrl) {
                accounts.get(r.account)!.avatarUrl = r.accountAvatarUrl;
            }
        });

        return accounts;
    }, [reposInAccounts]);

    const filteredRepos = useMemo(() => {
        return areGitHubWebhooksUnauthorized
            ? []
            : // filtering is done on server for Bitbucket Server
            isBitbucketServer
            ? Array.from(reposInAccounts || [])
            : Array.from(reposInAccounts || []).filter(
                  (r) =>
                      (!selectedAccount || r.account === selectedAccount) &&
                      `${r.name}`.toLowerCase().includes(repoSearchFilter.toLowerCase().trim()),
              );
    }, [areGitHubWebhooksUnauthorized, isBitbucketServer, repoSearchFilter, reposInAccounts, selectedAccount]);

    const reconfigure = useCallback(() => {
        openReconfigureWindow({
            account: selectedAccount,
            onSuccess: (p: { installationId: string; setupAction?: string }) => {
                setInstallationId(p.installationId);

                trackEvent("organisation_authorised", {
                    installation_id: p.installationId,
                    setup_action: p.setupAction,
                });
            },
        });
    }, [selectedAccount]);

    const onCreateProject = useCallback(
        (args: CreateProjectArgs) => {
            createProject.mutate(args, {
                onSuccess: (project) => {
                    onProjectCreated(project);
                },
                onError: (error) => {
                    toast(error?.message ?? "Failed to create new project.");
                },
            });
        },
        [createProject, onProjectCreated, toast],
    );

    // Creates the project
    const handleRepoSelected = useCallback(
        (repo) => {
            onCreateProject({
                name: repo.name,
                cloneUrl: repo.cloneUrl,
                slug: repo.path || repo.name,
                appInstallationId: String(repo.installationId),
            });
        },
        [onCreateProject],
    );

    // Adjusts selectedAccount when repos change if we don't already have a selected account
    useEffect(() => {
        // TODO: Once all providers filter on the server we can remove this account selection logic
        if (isBitbucketServer) {
            return;
        }

        if (reposInAccounts?.length === 0) {
            setSelectedAccountAndClearSearch(undefined);
        } else if (!selectedAccount) {
            const first = reposInAccounts?.[0];
            if (!!first?.installationUpdatedAt) {
                const mostRecent = reposInAccounts?.reduce((prev, current) =>
                    (prev.installationUpdatedAt || 0) > (current.installationUpdatedAt || 0) ? prev : current,
                );
                setSelectedAccountAndClearSearch(mostRecent?.account);
            } else {
                setSelectedAccountAndClearSearch(first?.account);
            }
        }
    }, [isBitbucketServer, reposInAccounts, selectedAccount, setSelectedAccountAndClearSearch]);

    return (
        <>
            <p className="text-gray-500 text-center text-base mt-12">
                {!isLoading && noReposAvailable ? "Select account on " : "Select a Git repository on "}
                <b>{selectedProvider?.host}</b> (<LinkButton onClick={onChangeGitProvider}>change</LinkButton>)
            </p>
            <div className={`mt-2 flex-col ${noReposAvailable && isGitHub ? "w-96" : ""}`}>
                <div className="px-8 flex flex-col space-y-2" data-analytics='{"label":"Identity"}'>
                    {!isBitbucketServer && (
                        <NewProjectAccountSelector
                            accounts={accounts}
                            selectedAccount={selectedAccount}
                            selectedProviderHost={selectedProvider?.host}
                            onAccountSelected={setSelectedAccountAndClearSearch}
                            onAddGitHubAccount={reconfigure}
                            onSelectGitProvider={onChangeGitProvider}
                        />
                    )}
                    <NewProjectSearchInput searchFilter={repoSearchFilter} onSearchFilterChange={setRepoSearchFilter} />
                </div>
                <div className="p-6 flex-col">
                    {isLoading ? (
                        <ReposLoading />
                    ) : (
                        <NewProjectRepoList
                            isCreating={createProject.isLoading}
                            filteredRepos={filteredRepos}
                            noReposAvailable={noReposAvailable}
                            onRepoSelected={handleRepoSelected}
                        />
                    )}
                    {!isLoading && noReposAvailable && isGitHub && (
                        <NewProjectAuthRequired
                            selectedProviderHost={selectedProvider?.host}
                            areGitHubWebhooksUnauthorized={areGitHubWebhooksUnauthorized}
                            onReconfigure={reconfigure}
                        />
                    )}
                </div>
            </div>
            {!isLoading && reposInAccounts && reposInAccounts.length > 0 && isGitHub && isGitHubAppEnabled && (
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
            {!isLoading && (filteredRepos?.length ?? 0) === 0 && repoSearchFilter.length > 0 && (
                <NewProjectCreateFromURL
                    repoSearchFilter={repoSearchFilter}
                    isCreating={createProject.isLoading}
                    onCreateProject={onCreateProject}
                />
            )}
        </>
    );
};

const ReposLoading: FC = () => (
    <div className="border rounded-xl border-gray-100 dark:border-gray-700 flex-col">
        <div className="px-12 py-16 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl w-96 h-h96 flex items-center justify-center">
            <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm">
                <img className="h-4 w-4 animate-spin" src={Spinner} alt="loading spinner" />
                <span>Fetching repositories...</span>
            </div>
        </div>
    </div>
);
