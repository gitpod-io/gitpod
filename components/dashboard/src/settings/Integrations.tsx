/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AuthProviderEntry, AuthProviderInfo } from "@gitpod/gitpod-protocol";
import React, { useContext, useEffect, useState } from "react";
import ContextMenu, { ContextMenuEntry } from "../components/ContextMenu";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { UserContext } from "../user-context";
import copy from '../images/copy.svg';
import exclamation from '../images/exclamation.svg';
import ThreeDots from '../icons/ThreeDots.svg';
import Modal from "../components/Modal";
import { openAuthorizeWindow } from "../provider-utils";
import CheckBox from '../components/CheckBox';
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import settingsMenu from "./settings-menu";

export default function Integrations() {

    return (<div>
        <PageWithSubMenu subMenu={settingsMenu}  title='Integrations' subtitle='Manage permissions for git providers and integrations.'>
            <GitProviders />
            <div className="h-12"></div>
            <GitIntegrations />
        </PageWithSubMenu>
    </div>);
}


function GitProviders() {

    const { user, setUser } = useContext(UserContext);

    const [authProviders, setAuthProviders] = useState<AuthProviderInfo[]>([]);
    const [allScopes, setAllScopes] = useState<Map<string, string[]>>(new Map());
    const [diconnectModal, setDisconnectModal] = useState<{ provider: AuthProviderInfo } | undefined>(undefined);
    const [editModal, setEditModal] = useState<{ provider: AuthProviderInfo, prevScopes: Set<string>, nextScopes: Set<string> } | undefined>(undefined);

    useEffect(() => {
        updateAuthProviders();
    }, []);

    useEffect(() => {
        updateCurrentScopes();
    }, [user, authProviders]);

    const updateAuthProviders = async () => {
        setAuthProviders(await getGitpodService().server.getAuthProviders());
    }

    const updateCurrentScopes = async () => {
        if (user) {
            const scopesByProvider = new Map<string, string[]>();
            const connectedProviders = user.identities.map(i => authProviders.find(ap => ap.authProviderId === i.authProviderId));
            for (let provider of connectedProviders) {
                if (!provider) {
                    continue;
                }
                const token = await getGitpodService().server.getToken({ host: provider.host });
                scopesByProvider.set(provider.authProviderId, (token?.scopes?.slice() || []));
            }
            setAllScopes(scopesByProvider);
        }
    }

    const isConnected = (authProviderId: string) => {
        return !!user?.identities?.find(i => i.authProviderId === authProviderId);
    };

    const gitProviderMenu = (provider: AuthProviderInfo) => {
        const result: ContextMenuEntry[] = [];
        const connected = isConnected(provider.authProviderId);
        if (connected) {
            result.push({
                title: 'Edit Permissions',
                onClick: () => startEditPermissions(provider),
                separator: !provider.settingsUrl,
            });
            if (provider.settingsUrl) {
                result.push({
                    title: `Manage on ${provider.host}`,
                    onClick: () => {
                        window.open(provider.settingsUrl, "_blank", "noopener,noreferrer");
                    },
                    separator: true,
                });
            }
            const connectedWithSecondProvider = authProviders.some(p => p.authProviderId !== provider.authProviderId && isConnected(p.authProviderId))
            if (connectedWithSecondProvider) {
                result.push({
                    title: 'Disconnect',
                    customFontStyle: 'text-red-600',
                    onClick: () => setDisconnectModal({ provider })
                });
            }
        } else {
            result.push({
                title: 'Connect',
                customFontStyle: 'text-green-600',
                onClick: () => connect(provider)
            })
        }
        return result;
    };

    const getUsername = (authProviderId: string) => {
        return user?.identities?.find(i => i.authProviderId === authProviderId)?.authName;
    };

    const getPermissions = (authProviderId: string) => {
        return allScopes.get(authProviderId);
    };

    const connect = async (ap: AuthProviderInfo) => {
        await doAuthorize(ap.host, ap.requirements?.default);
    }

    const disconnect = async (ap: AuthProviderInfo) => {
        setDisconnectModal(undefined);
        const returnTo = gitpodHostUrl.with({ pathname: 'login-success' }).toString();
        const deauthorizeUrl = gitpodHostUrl.withApi({
            pathname: '/deauthorize',
            search: `returnTo=${returnTo}&host=${ap.host}`
        }).toString();

        try {
            await fetch(deauthorizeUrl);
            console.log(`Deauthorized for ${ap.host}`);

            updateUser();
        } catch (error) {
            console.log(`Failed to deauthorize for ${ap.host}`);
        }
    }

    const startEditPermissions = async (provider: AuthProviderInfo) => {
        // todo: add spinner

        const token = await getGitpodService().server.getToken({ host: provider.host });
        if (token) {
            setEditModal({ provider, prevScopes: new Set(token.scopes), nextScopes: new Set(token.scopes) });
        }
    }

    const updateUser = async () => {
        const user = await getGitpodService().server.getLoggedInUser();
        setUser(user);
    }

    const doAuthorize = async (host: string, scopes?: string[]) => {
        try {
            await openAuthorizeWindow({ host, scopes, onSuccess: () => updateUser() });
        } catch (error) {
            console.log(error)
        }
    }

    const updatePermissions = async () => {
        if (!editModal) {
            return;
        }
        try {
            await doAuthorize(editModal.provider.host, Array.from(editModal.nextScopes));
        } catch (error) {
            console.log(error);
        }
        setEditModal(undefined);
    }
    const onChangeScopeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editModal) {
            return;
        }
        const scope = e.target.name;
        const nextScopes = new Set(editModal.nextScopes);
        if (e.target.checked) {
            nextScopes.add(scope);
        } else {
            nextScopes.delete(scope);
        }
        setEditModal({ ...editModal, nextScopes });
    }

    const getDescriptionForScope = (scope: string) => {
        switch (scope) {
            case "user:email": return "Read-only access to your email addresses";
            case "read:user": return "Read-only access to your profile information";
            case "public_repo": return "Write access to code in public repositories and organizations";
            case "repo": return "Read/write access to code in private repositories and organizations";
            case "read:org": return "Read-only access to organizations (used to suggest organizations when forking a repository)";
            case "workflow": return "Allow updating GitHub Actions workflow files";
            // GitLab
            case "read_user": return "Read-only access to your email addresses";
            case "api": return "Allow making API calls (used to set up a webhook when enabling prebuilds for a repository)";
            case "read_repository": return "Read/write access to your repositories";
            // Bitbucket
            case "account": return "Read-only access to your account information";
            case "repository": return "Read-only access to your repositories (note: Bitbucket doesn't support revoking scopes)";
            case "repository:write": return "Read/write access to your repositories (note: Bitbucket doesn't support revoking scopes)";
            case "pullrequest": return "Read access to pull requests and ability to collaborate via comments, tasks, and approvals (note: Bitbucket doesn't support revoking scopes)";
            case "pullrequest:write": return "Allow creating, merging and declining pull requests (note: Bitbucket doesn't support revoking scopes)";
            case "webhook": return "Allow installing webhooks (used when enabling prebuilds for a repository, note: Bitbucket doesn't support revoking scopes)";
            default: return "";
        }
    }

    return (<div>

        {diconnectModal && (
            <Modal visible={true} onClose={() => setDisconnectModal(undefined)}>
                <h3 className="pb-2">Disconnect Provider</h3>
                <div className="border-t border-b border-gray-200 mt-2 -mx-6 px-6 py-4">
                    <p className="pb-4 text-gray-500 text-base">Are you sure you want to disconnect the following provider?</p>

                    <div className="flex flex-col rounded-xl p-3 bg-gray-100">
                        <div className="text-gray-700 text-md font-semibold">{diconnectModal.provider.authProviderType}</div>
                        <div className="text-gray-400 text-md">{diconnectModal.provider.host}</div>
                    </div>
                </div>
                <div className="flex justify-end mt-6">
                    <button className={"ml-2 danger secondary"} onClick={() => disconnect(diconnectModal.provider)}>Disconnect Provider</button>
                </div>
            </Modal>
        )}

        {editModal && (
            <Modal visible={true} onClose={() => setEditModal(undefined)}>
                <h3 className="pb-2">Edit Permissions</h3>
                <div className="border-t border-b border-gray-200 mt-2 -mx-6 px-6 py-4">
                    <div className="text-gray-500">
                        Configure provider permissions.
                    </div>
                    {(editModal.provider.scopes || []).map(scope => (
                        <div key={`scope-${scope}`}>
                            <CheckBox
                                name={scope}
                                desc={getDescriptionForScope(scope)}
                                title={scope}
                                key={`scope-checkbox-${scope}`}
                                checked={editModal.nextScopes.has(scope)}
                                disabled={editModal.provider.requirements?.default.includes(scope)}
                                onChange={onChangeScopeHandler}
                            ></CheckBox>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end mt-6">
                    <button onClick={() => updatePermissions()}
                        disabled={equals(editModal.nextScopes, editModal.prevScopes)}
                    >
                        Update Permissions
                    </button>
                </div>
            </Modal>
        )}

    <h3>Git Providers</h3>
    <h2>Manage permissions for git providers.</h2>
        <div className="flex flex-col pt-6 space-y-2">
            {authProviders && authProviders.map(ap => (
                <div key={"ap-" + ap.authProviderId} className="flex-grow flex flex-row hover:bg-gray-100 rounded-xl h-16 w-full transition ease-in-out group">
                    <div className="px-4 self-center w-1/12">
                        <div className={"rounded-full w-3 h-3 text-sm align-middle " + (isConnected(ap.authProviderId) ? "bg-green-500" : "bg-gray-400")}>
                            &nbsp;
                        </div>
                    </div>
                    <div className="p-0 my-auto flex flex-col w-3/12">
                        <span className="my-auto font-medium truncate overflow-ellipsis">{ap.authProviderType}</span>
                        <span className="text-sm my-auto text-gray-400 truncate overflow-ellipsis">{ap.host}</span>
                    </div>
                    <div className="p-0 my-auto flex flex-col w-2/12">
                        <span className="my-auto truncate text-gray-500 overflow-ellipsis">{getUsername(ap.authProviderId) || "–"}</span>
                        <span className="text-sm my-auto text-gray-400">Username</span>
                    </div>
                    <div className="p-0 my-auto flex flex-col w-5/12">
                        <span className="my-auto truncate text-gray-500 overflow-ellipsis">{getPermissions(ap.authProviderId)?.join(", ") || "–"}</span>
                        <span className="text-sm my-auto text-gray-400">Permissions</span>
                    </div>
                    <div className="my-auto flex w-1/12 pl-8 mr-4 opacity-0 group-hover:opacity-100">
                        <div className="self-center hover:bg-gray-200 rounded-md cursor-pointer w-8">
                            <ContextMenu menuEntries={gitProviderMenu(ap)}>
                                <img className="w-8 h-8 p-1" src={ThreeDots} alt="Actions" />
                            </ContextMenu>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>);
}

function GitIntegrations() {

    const { user } = useContext(UserContext);

    const [providers, setProviders] = useState<AuthProviderEntry[]>([]);

    const [modal, setModal] = useState<{ mode: "new" } | { mode: "edit", provider: AuthProviderEntry } | { mode: "delete", provider: AuthProviderEntry } | undefined>(undefined);

    useEffect(() => {
        updateOwnAuthProviders();
    }, []);

    const updateOwnAuthProviders = async () => {
        setProviders(await getGitpodService().server.getOwnAuthProviders());
    }

    const deleteProvider = async (provider: AuthProviderEntry) => {
        try {
            await getGitpodService().server.deleteOwnAuthProvider(provider);
        } catch (error) {
            console.log(error);
        }
        setModal(undefined);
        updateOwnAuthProviders();
    }

    const gitProviderMenu = (provider: AuthProviderEntry) => {
        const result: ContextMenuEntry[] = [];
        result.push({
            title: provider.status === "verified" ? "Edit Configuration" : "Activate Integration",
            onClick: () => setModal({ mode: "edit", provider }),
            separator: true,
        })
        result.push({
            title: 'Remove',
            customFontStyle: 'text-red-600',
            onClick: () => setModal({ mode: "delete", provider })
        });
        return result;
    };

    return (<div>

        {modal?.mode === "new" && (
            <GitIntegrationModal mode={modal.mode} userId={user?.id || "no-user"} onClose={() => setModal(undefined)} update={updateOwnAuthProviders} />
        )}
        {modal?.mode === "edit" && (
            <GitIntegrationModal mode={modal.mode} userId={user?.id || "no-user"} provider={modal.provider} onClose={() => setModal(undefined)} update={updateOwnAuthProviders} />
        )}
        {modal?.mode === "delete" && (
            <Modal visible={true} onClose={() => setModal(undefined)}>
                <h3 className="pb-2">Remove Integration</h3>
                <div className="border-t border-b border-gray-200 mt-2 -mx-6 px-6 py-4">
                    <p className="pb-4 text-gray-500 text-base">Are you sure you want to remove the following git integration?</p>

                    <div className="flex flex-col rounded-xl p-3 bg-gray-100">
                        <div className="text-gray-700 text-md font-semibold">{modal.provider.type}</div>
                        <div className="text-gray-400 text-md">{modal.provider.host}</div>
                    </div>
                </div>
                <div className="flex justify-end mt-6">
                    <button className={"ml-2 danger secondary"} onClick={() => deleteProvider(modal.provider)}>Remove Integration</button>
                </div>
            </Modal>
        )}

        <div className="flex items-start sm:justify-between mb-2">
            <div>
                <h3>Git Integrations</h3>
                <h2 className="text-gray-500">Manage git integrations for GitLab or GitHub self-hosted instances.</h2>
            </div>
            {providers.length !== 0
            ?
            <div className="mt-3 flex mt-0">
                <button onClick={() => setModal({ mode: "new" })} className="ml-2">New Integration</button>
            </div>
            : null}
        </div>

        {providers && providers.length === 0 && (
            <div className="w-full flex h-80 mt-2 rounded-xl bg-gray-100">
                <div className="m-auto text-center">
                    <h3 className="self-center text-gray-500 mb-4">No Git Integrations</h3>
                    <div className="text-gray-500 mb-6">In addition to the default Git Providers you can authorize<br /> with a self hosted instace of a provider.</div>
                    <button className="self-center" onClick={() => setModal({ mode: "new" })}>New Integration</button>
                </div>
            </div>
        )}
        <div className="flex flex-col pt-6 space-y-2">
            {providers && providers.map(ap => (
                <div key={"ap-" + ap.id} className="flex-grow flex flex-row hover:bg-gray-100 rounded-xl h-16 w-full transition ease-in-out group">

                    <div className="px-4 self-center w-1/12">
                        <div className={"rounded-full w-3 h-3 text-sm align-middle " + (ap.status === "verified" ? "bg-green-500" : "bg-gray-400")}>
                            &nbsp;
                        </div>
                    </div>
                    <div className="p-0 my-auto flex flex-col w-3/12">
                        <span className="my-auto font-medium truncate overflow-ellipsis">{ap.type}</span>
                    </div>
                    <div className="p-0 my-auto flex flex-col w-7/12">
                        <span className="my-auto truncate text-gray-500 overflow-ellipsis">{ap.host}</span>
                    </div>
                    <div className="my-auto flex w-1/12 pl-8 opacity-0 group-hover:opacity-100">
                        <div className="self-center hover:bg-gray-200 rounded-md cursor-pointer w-8">
                            <ContextMenu menuEntries={gitProviderMenu(ap)}>
                                <img className="w-8 h-8 p-1" src={ThreeDots} alt="Actions" />
                            </ContextMenu>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>);
}

function GitIntegrationModal(props: ({
    mode: "new",
} | {
    mode: "edit",
    provider: AuthProviderEntry
}) & {
    userId: string,
    onClose?: () => void
    update?: () => void
}) {

    const callbackUrl = (host: string) => {
        const pathname = `/auth/${host}/callback`;
        return gitpodHostUrl.with({ pathname }).toString();
    }

    const [type, setType] = useState<string>("GitLab");
    const [host, setHost] = useState<string>("gitlab.example.com");
    const [redirectURL, setRedirectURL] = useState<string>(callbackUrl("gitlab.example.com"));
    const [clientId, setClientId] = useState<string>("");
    const [clientSecret, setClientSecret] = useState<string>("");
    const [busy, setBusy] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const [validationError, setValidationError] = useState<string | undefined>();

    useEffect(() => {
        if (props.mode === "edit") {
            setType(props.provider.type);
            setHost(props.provider.host);
            setClientId(props.provider.oauth.clientId);
            setClientSecret(props.provider.oauth.clientSecret);
            setRedirectURL(props.provider.oauth.callBackUrl);
        }
    }, []);

    useEffect(() => {
        validate();
    }, [clientId, clientSecret])

    const close = () => props.onClose && props.onClose();
    const updateList = () => props.update && props.update();

    const activate = async () => {
        let entry = (props.mode === "new") ? {
            host,
            type,
            clientId,
            clientSecret,
            ownerId: props.userId
        } as AuthProviderEntry.NewEntry : {
            id: props.provider.id,
            ownerId: props.userId,
            clientId,
            clientSecret: clientSecret === "redacted" ? undefined : clientSecret
        } as AuthProviderEntry.UpdateEntry;

        setBusy(true);
        setErrorMessage(undefined);
        try {
            const newProvider = await getGitpodService().server.updateOwnAuthProvider({ entry });

            // the server is checking periodically for updates of dynamic providers, thus we need to
            // wait at least 2 seconds for the changes to be propagated before we try to use this provider.
            await new Promise(resolve => setTimeout(resolve, 2000));

            updateList();

            // just open the authorization window and do *not* await
            openAuthorizeWindow({ host: newProvider.host, onSuccess: updateList });

            // close the modal, as the creation phase is done anyways.
            close();
        } catch (error) {
            console.log(error);
            setErrorMessage("message" in error ? error.message : "Failed to update Git provider");
        }
        setBusy(false);
    }

    const updateHostValue = (host: string) => {
        if (props.mode === "new") {
            setHost(host);
            setRedirectURL(callbackUrl(host));
            setErrorMessage(undefined);
        }
    }

    const updateClientId = (value: string) => {
        setClientId(value);
    }
    const updateClientSecret = (value: string) => {
        setClientSecret(value);
    }

    const validate = () => {
        const errors: string[] = [];
        if (clientId.trim().length === 0) {
            errors.push("Client ID is missing.");
        }
        if (clientSecret.trim().length === 0) {
            errors.push("Client Secret is missing.");
        }
        if (errors.length === 0) {
            setValidationError(undefined);
            return true;
        } else {
            setValidationError(errors.join("\n"));
            return false;
        }
    }

    const getRedirectUrlDescription = (type: string, host: string) => {
        let settingsUrl = ``;
        switch (type) {
            case "GitHub":
                settingsUrl = `${host}/settings/developers`;
                break;
            case "GitLab":
                settingsUrl = `${host}/profile/applications`;
                break;
            default: return undefined;
        }
        let docsUrl = ``;
        switch (type) {
            case "GitHub":
                docsUrl = `https://www.gitpod.io/docs/github-integration/#oauth-application`;
                break;
            case "GitLab":
                docsUrl = `https://www.gitpod.io/docs/gitlab-integration/#oauth-application`;
                break;
            default: return undefined;
        }

        return (<span>
            Use this redirect URL to update the OAuth application.
            Go to <a href={`https://${settingsUrl}`} target="_blank" rel="noopener" className="text-gray-400 underline underline-thickness-thin underline-offset-small hover:text-gray-600">developer settings</a> and setup the OAuth application.&nbsp;
            <a href={docsUrl} target="_blank" rel="noopener" className="text-gray-400 underline underline-thickness-thin underline-offset-small hover:text-gray-600">Learn more</a>.
        </span>);
    }

    const copyRedirectUrl = () => {
        const el = document.createElement("textarea");
        el.value = redirectURL;
        document.body.appendChild(el);
        el.select();
        try {
            document.execCommand("copy");
        } finally {
            document.body.removeChild(el);
        }
    };

    return (<Modal visible={!!props} onClose={close}>
        <h3 className="pb-2">{props.mode === "new" ? "New Git Integration" : "Git Integration"}</h3>
        <div className="space-y-4 border-t border-b border-gray-200 mt-2 -mx-6 px-6 py-4">
            {props.mode === "edit" && props.provider.status === "pending" && (
                <div className="flex rounded-md bg-gitpod-kumquat-light p-3">
                    <img className="w-4 h-4 mx-2 my-auto" src={exclamation} />
                    <span className="text-red-600">You need to activate this integration.</span>
                </div>
            )}
            <div className="flex flex-col">
                <span className="text-gray-500">Configure a git integration with a GitLab or GitHub self-hosted instance.</span>
            </div>
            {props.mode === "new" && (
                <div className="flex flex-col space-y-2">
                    <label htmlFor="type" className="font-medium">Provider Type</label>
                    <select name="type" value={type} disabled={props.mode !== "new"} className="w-full"
                        onChange={(e) => setType(e.target.value)}>
                        <option value="GitHub">GitHub</option>
                        <option value="GitLab">GitLab</option>
                    </select>
                </div>
            )}
            <div className="flex flex-col space-y-2">
                <label htmlFor="hostName" className="font-medium">Provider Host Name</label>
                <input name="hostName" disabled={props.mode === "edit"} type="text" value={host} className="w-full"
                    onChange={(e) => updateHostValue(e.target.value)} />
            </div>
            <div className="flex flex-col space-y-2">
                <label htmlFor="redirectURL" className="font-medium">Redirect URL</label>
                <div className="w-full relative">
                    <input name="redirectURL" disabled={true} readOnly={true} type="text" value={redirectURL} className="w-full truncate" />
                    <div className="cursor-pointer" onClick={() => copyRedirectUrl()}>
                        <img src={copy} title="Copy the Redirect URL to clippboard" className="absolute top-1/3 right-3" />
                    </div>
                </div>
                <span className="text-gray-500 text-sm">{getRedirectUrlDescription(type, host)}</span>
            </div>
            <div className="flex flex-col space-y-2">
                <label htmlFor="clientId" className="font-medium">Client ID</label>
                <input name="clientId" type="text" value={clientId} className="w-full"
                    onChange={(e) => updateClientId(e.target.value)} />
            </div>
            <div className="flex flex-col space-y-2">
                <label htmlFor="clientSecret" className="font-medium">Client Secret</label>
                <input name="clientSecret" type="password" value={clientSecret} className="w-full"
                    onChange={(e) => updateClientSecret(e.target.value)} />
            </div>
            {errorMessage && (
                <div className="flex rounded-md bg-red-600 p-3">
                    <img className="w-4 h-4 mx-2 my-auto" src={exclamation} />
                    <span className="text-white">{errorMessage}</span>
                </div>
            )}
            {!!validationError && (
                <div className="flex rounded-md bg-red-600 p-3">
                    <img className="w-4 h-4 mx-2 my-auto filter-brightness-10" src={exclamation} />
                    <span className="text-white">{validationError}</span>
                </div>
            )}
        </div>
        <div className="flex justify-end mt-6">
            <button onClick={() => validate() && activate()} disabled={!!validationError || busy}>Activate Integration</button>
        </div>
    </Modal>);
}

function equals(a: Set<string>, b: Set<string>): boolean {
    return a.size === b.size && Array.from(a).every(e => b.has(e));
}