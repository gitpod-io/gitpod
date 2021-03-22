import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import React, { useContext, useEffect, useState } from "react";
import ContextMenu, { ContextMenuEntry } from "../components/ContextMenu";
import { SettingsPage } from "./SettingsPage";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { UserContext } from "../user-context";
import ThreeDots from '../icons/ThreeDots.svg';
import Modal from "../components/Modal";

export default function Integrations() {

    return (<div>
        <SettingsPage title='Integrations' subtitle='Manage permissions for git providers and git integrations'>
            <GitProviders />
        </SettingsPage>
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
                separator: true,
            });
            result.push(            {
                title: 'Disconnect',
                customFontStyle: 'text-red-600',
                onClick: () => setDisconnectModal({ provider })
            })
        } else {
            result.push(            {
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
        const thisUrl = gitpodHostUrl;
        const returnTo = gitpodHostUrl.with({ pathname: 'login-success' }).toString();
        const url = thisUrl.withApi({
            pathname: '/authorize',
            search: `returnTo=${returnTo}&host=${ap.host}&override=true&scopes=${(ap.requirements?.default || []).join(',')}`
        }).toString();
        const newWindow = window.open(url, "gitpod-connect");
        if (!newWindow) {
            console.log(`Failed to open authorize window for ${ap.host}`);
        }

        await openAuthWindow(ap);
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

    const openAuthWindow = async (ap: AuthProviderInfo, scopes?: string[]) => {
        const returnTo = gitpodHostUrl.with({ pathname: 'login-success' }).toString();
        const url = gitpodHostUrl.withApi({
            pathname: '/authorize',
            search: `returnTo=${encodeURIComponent(returnTo)}&host=${ap.host}&override=true&scopes=${(scopes || ap.requirements?.default || []).join(',')}`
        }).toString();
        const newWindow = window.open(url, "gitpod-connect");
        if (!newWindow) {
            console.log(`Failed to open the authorize window for ${ap.host}`);
        }

        const eventListener = (event: MessageEvent) => {
            // todo: check event.origin

            if (event.data === "auth-success") {
                window.removeEventListener("message", eventListener);

                if (event.source && "close" in event.source && event.source.close) {
                    console.log(`try to close window`);
                    event.source.close();
                } else {
                    // todo: add a button to the /login-success page to close, if this should not work as expected
                }
                updateUser();
            }
        };

        window.addEventListener("message", eventListener);
    }

    const updatePermissions = async () => {
        if (!editModal) {
            return;
        }
        try {
            await openAuthWindow(editModal.provider, Array.from(editModal.nextScopes));
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

    return (<div>
        <Modal visible={!!diconnectModal} onClose={() => setDisconnectModal(undefined)}>
            <h3>You are about to disconnect {diconnectModal?.provider.host}</h3>
            <div>
                <button onClick={() => disconnect(diconnectModal?.provider!)}>Proceed</button>
            </div>
        </Modal>

        <Modal visible={!!editModal} onClose={() => setEditModal(undefined)}>
            {editModal && (
                <div>
                    <h3>Permissions granted</h3>
                    <div>
                        {editModal && editModal.provider.scopes!.map(scope => (
                            <div key={`scope-${scope}`}>
                                <CheckBox
                                    name={scope}
                                    desc={scope}
                                    title={scope}
                                    key={`scope-checkbox-${scope}`}
                                    checked={editModal.nextScopes.has(scope)}
                                    disabled={editModal.provider.requirements?.default.includes(scope)}
                                    onChange={onChangeScopeHandler}
                                ></CheckBox>
                            </div>
                        ))}
                    </div>
                    <div>
                        <button onClick={() => updatePermissions()}
                            disabled={equals(editModal.nextScopes, editModal.prevScopes)}
                        >
                            Update
                    </button>
                    </div>
                </div>
            )}
        </Modal>

        <h3>Git Providers</h3>
        <h2>Manage permissions for git providers.</h2>
        <div className="flex flex-col pt-6 space-y-2">
            {authProviders && authProviders.map(ap => (
                <div key={"ap-" + ap.authProviderId} className="flex-grow flex flex-row hover:bg-gray-100 rounded-xl h-16 w-full">
                    <div className="px-4 self-center">
                        <div className={"rounded-full w-3 h-3 text-sm align-middle " + (isConnected(ap.authProviderId) ? "bg-green-500" : "bg-gray-400")}>
                            &nbsp;
                        </div>
                    </div>
                    <div className="p-0 my-auto flex flex-col w-2/12">
                        <span className="my-auto font-medium truncate overflow-ellipsis">{ap.authProviderType}</span>
                        <span className="text-sm my-auto text-gray-400 truncate overflow-ellipsis">{ap.host}</span>
                    </div>
                    <div className="p-0 my-auto flex flex-col w-2/12">
                        <span className="my-auto truncate text-gray-500 overflow-ellipsis">{getUsername(ap.authProviderId) || "–"}</span>
                        <span className="text-sm my-auto text-gray-400 truncate overflow-ellipsis">Username</span>
                    </div>
                    <div className="flex-grow p-0 my-auto flex flex-col">
                        <span className="my-auto truncate text-gray-500 overflow-ellipsis">{getPermissions(ap.authProviderId)?.join(", ") || "–"}</span>
                        <span className="text-sm my-auto text-gray-400 truncate overflow-ellipsis">Permissions</span>
                    </div>
                    <div className="self-center">
                        <ContextMenu menuEntries={gitProviderMenu(ap)}>
                            <img className="w-8 h-8 p-1" src={ThreeDots} alt="Actions" />
                        </ContextMenu>
                    </div>
                </div>
            ))}
        </div>
    </div>);
}

function CheckBox(props: {
    name?: string,
    title: string,
    desc: string,
    checked: boolean,
    disabled?: boolean,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
    const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
        checked: props.checked,
        disabled: props.disabled,
        onChange: props.onChange,
    };
    if (props.name) {
        inputProps.name = props.name;
    }

    const checkboxId = `checkbox-${props.title}-${String(Math.random())}`;

    return <div className="flex mt-4">
        <input className={"focus:ring-0 mt-1 rounded-sm cursor-pointer " + (props.checked ? 'bg-gray-800' : '')} type="checkbox"
            id={checkboxId}
            {...inputProps}
        />
        <div className="flex flex-col ml-2">
            <label htmlFor={checkboxId} className="text-gray-700 text-md font-semibold">{props.title}</label>
            <div className="text-gray-400 text-md">{props.desc}</div>
        </div>
    </div>
}

function equals(a: Set<string>, b: Set<string>): boolean {
    return a.size === b.size && Array.from(a).every(e => b.has(e));
}