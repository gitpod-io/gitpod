/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { Redirect } from "react-router";
import { TeamMemberInfo } from "@gitpod/gitpod-protocol";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import { useCurrentTeam } from "./teams-context";
import { getTeamSettingsMenu } from "./TeamSettings";
import { UserContext } from "../user-context";
import { oidcService, publicApiTeamMembersToProtocol, teamsService } from "../service/public-api";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { Item, ItemField, ItemFieldContextMenu, ItemFieldIcon, ItemsList } from "../components/ItemsList";
import { ContextMenuEntry } from "../components/ContextMenu";
import Modal from "../components/Modal";

import copy from "../images/copy.svg";
import exclamation from "../images/exclamation.svg";

export default function SSO() {
    const { user } = useContext(UserContext);
    const team = useCurrentTeam();
    const [teamBillingMode, setTeamBillingMode] = useState<BillingMode | undefined>(undefined);
    const [isUserOwner, setIsUserOwner] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const { oidcServiceEnabled } = useContext(FeatureFlagContext);

    useEffect(() => {
        if (!team) {
            return;
        }
        (async () => {
            const memberInfos = await teamsService.getTeam({ teamId: team!.id }).then((resp) => {
                return publicApiTeamMembersToProtocol(resp.team?.members || []);
            });
            getGitpodService().server.getBillingModeForTeam(team.id).then(setTeamBillingMode).catch(console.error);

            const currentUserInTeam = memberInfos.find((member: TeamMemberInfo) => member.userId === user?.id);
            const isUserOwner = currentUserInTeam?.role === "owner";
            setIsUserOwner(isUserOwner);
            setIsLoading(false);
        })();
    }, [team]);

    if (!isUserOwner) {
        return <Redirect to={`/`} />;
    }

    return (
        <PageWithSubMenu
            subMenu={getTeamSettingsMenu({ team, billingMode: teamBillingMode, ssoEnabled: oidcServiceEnabled })}
            title="SSO"
            subtitle="Setup SSO for your organization."
        >
            {isLoading && (
                <div className="p-20">
                    <Spinner className="h-5 w-5 animate-spin" />
                </div>
            )}
            {!isLoading && team && isUserOwner && <OIDCClients organizationId={team.id} />}
        </PageWithSubMenu>
    );
}

function OIDCClients(props: { organizationId: string }) {
    const [clientConfigs, setClientConfigs] = useState<OIDCClientConfig[]>([]);

    const [modal, setModal] = useState<
        | { mode: "new" }
        | { mode: "edit"; clientConfig: OIDCClientConfig }
        | { mode: "delete"; clientConfig: OIDCClientConfig }
        | undefined
    >(undefined);

    useEffect(() => {
        reloadClientConfigs().catch(console.error);
    }, []);

    const reloadClientConfigs = async () => {
        const clientConfigs = await oidcService
            .listClientConfigs({ organizationId: props.organizationId })
            .then((resp) => {
                return resp.clientConfigs;
            });
        setClientConfigs(clientConfigs);
    };

    const loginWith = (id: string) => {
        window.location.href = gitpodHostUrl.with({ pathname: `/iam/oidc/start`, search: `id=${id}` }).toString();
    };

    const configMenu = (clientConfig: OIDCClientConfig) => {
        const result: ContextMenuEntry[] = [];
        result.push({
            title: "Login",
            onClick: () => loginWith(clientConfig.id),
            separator: true,
        });
        result.push({
            title: "Edit",
            onClick: () => setModal({ mode: "edit", clientConfig }),
            separator: true,
        });
        result.push({
            title: "Remove",
            customFontStyle: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
            onClick: () => setModal({ mode: "delete", clientConfig }),
        });
        return result;
    };

    return (
        <>
            {modal?.mode === "new" && (
                <OIDCClientConfigModal
                    mode={modal.mode}
                    organizationId={props.organizationId}
                    onClose={() => setModal(undefined)}
                    onUpdate={reloadClientConfigs}
                />
            )}

            {modal?.mode === "edit" && <></>}
            {modal?.mode === "delete" && <></>}

            <div className="flex items-start sm:justify-between mb-2">
                <div>
                    <h3>Single sign sign-on with OIDC</h3>
                    <h2>Setup SSO for your organization.</h2>
                </div>
                {clientConfigs.length !== 0 ? (
                    <div className="mt-3 flex mt-0">
                        <button onClick={() => setModal({ mode: "new" })} className="ml-2">
                            New OIDC Client
                        </button>
                    </div>
                ) : null}
            </div>

            {clientConfigs.length === 0 && (
                <div className="w-full flex h-80 mt-2 rounded-xl bg-gray-100 dark:bg-gray-900">
                    <div className="m-auto text-center">
                        <h3 className="self-center text-gray-500 dark:text-gray-400 mb-4">No OIDC Clients</h3>
                        <div className="text-gray-500 mb-6">
                            Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor
                            invidunt ut labore et dolore magna aliquyam
                        </div>
                        <button className="self-center" onClick={() => setModal({ mode: "new" })}>
                            New OIDC Client
                        </button>
                    </div>
                </div>
            )}

            <ItemsList className="pt-6">
                {clientConfigs.map((cc) => (
                    <Item key={"ap-" + cc.id} className="h-16">
                        <ItemFieldIcon>
                            <div className={"rounded-full w-3 h-3 text-sm align-middle m-auto bg-gray-400"}>&nbsp;</div>
                        </ItemFieldIcon>
                        <ItemField className="w-3/12 flex flex-col my-auto">
                            <span className="font-medium truncate overflow-ellipsis">{cc.id}</span>
                        </ItemField>
                        <ItemField className="w-7/12 flex flex-col my-auto">
                            <span className="my-auto truncate text-gray-500 overflow-ellipsis">
                                {cc.oidcConfig?.issuer}
                            </span>
                        </ItemField>
                        <ItemFieldContextMenu menuEntries={configMenu(cc)} />
                    </Item>
                ))}
            </ItemsList>
        </>
    );
}

function OIDCClientConfigModal(
    props: (
        | {
              mode: "new";
          }
        | {
              mode: "edit";
              clientConfig: OIDCClientConfig;
          }
    ) & {
        organizationId: string;
        onClose?: () => void;
        closeable?: boolean;
        onUpdate?: () => void;
    },
) {
    const [mode] = useState<"new" | "edit">("new");
    const [busy] = useState<boolean>(false);
    const [errorMessage] = useState<string | undefined>(undefined);
    const [validationError] = useState<string | undefined>(undefined);

    const [issuer, setIssuer] = useState<string>("");
    const [clientId, setClientId] = useState<string>("");
    const [clientSecret, setClientSecret] = useState<string>("");
    const [callbackUrl, setCallbackUrl] = useState<string>("");

    useEffect(() => {
        const pathname = `/iam/oidc/callback`;
        setCallbackUrl(gitpodHostUrl.with({ pathname }).toString());
    }, []);

    const updateIssuer = (issuer: string) => {
        setIssuer(issuer);
    };

    const updateClientId = (value: string) => {
        setClientId(value.trim());
    };

    const updateClientSecret = (value: string) => {
        setClientSecret(value.trim());
    };

    const copyRedirectUrl = () => {
        const el = document.createElement("textarea");
        el.value = callbackUrl;
        document.body.appendChild(el);
        el.select();
        try {
            document.execCommand("copy");
        } finally {
            document.body.removeChild(el);
        }
    };

    const save = async () => {
        try {
            const response = await oidcService.createClientConfig({
                config: {
                    organizationId: props.organizationId,
                    oauth2Config: {
                        clientId: clientId,
                        clientSecret: clientSecret,
                    },
                    oidcConfig: {
                        issuer: issuer,
                    },
                },
            });
            console.log(response.config?.id);
            onUpdate();
            onClose();
        } catch (error) {}
    };

    const onClose = () => props.onClose && props.onClose();
    const onUpdate = () => props.onUpdate && props.onUpdate();

    return (
        <Modal visible={!!props} onClose={onClose} closeable={props.closeable}>
            <h3 className="pb-2">{mode === "new" ? "New OIDC Client" : "OIDC Client"}</h3>
            <div className="space-y-4 border-t border-b border-gray-200 dark:border-gray-800 mt-2 -mx-6 px-6 py-4">
                <div className="flex flex-col">
                    <span className="text-gray-500">Enter this information from your OIDC service.</span>
                </div>

                <div className="overscroll-contain max-h-96 overflow-y-auto pr-2">
                    <div className="flex flex-col space-y-2">
                        <label htmlFor="issuer" className="font-medium">
                            Issuer URL
                        </label>
                        <input
                            id="issuer"
                            type="text"
                            value={issuer}
                            placeholder="https://accounts.google.com"
                            className="w-full"
                            onChange={(e) => updateIssuer(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col space-y-2">
                        <label htmlFor="redirectURL" className="font-medium">
                            Redirect URL
                        </label>
                        <div className="w-full relative">
                            <input
                                id="redirectURL"
                                disabled={true}
                                readOnly={true}
                                type="text"
                                value={callbackUrl}
                                className="w-full pr-8"
                            />
                            <div className="cursor-pointer" onClick={() => copyRedirectUrl()}>
                                <img
                                    src={copy}
                                    title="Copy the Redirect URL to clipboard"
                                    className="absolute top-1/3 right-3"
                                />
                            </div>
                        </div>
                        <span className="text-gray-500 text-sm"></span>
                    </div>
                    <div className="flex flex-col space-y-2">
                        <label htmlFor="clientId" className="font-medium">
                            Client ID
                        </label>
                        <input
                            name="clientId"
                            type="text"
                            value={clientId}
                            className="w-full"
                            onChange={(e) => updateClientId(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col space-y-2">
                        <label htmlFor="clientSecret" className="font-medium">
                            Client Secret
                        </label>
                        <input
                            name="clientSecret"
                            type="password"
                            value={clientSecret}
                            className="w-full"
                            onChange={(e) => updateClientSecret(e.target.value)}
                        />
                    </div>
                </div>

                {(errorMessage || validationError) && (
                    <div className="flex rounded-md bg-red-600 p-3">
                        <img className="w-4 h-4 mx-2 my-auto filter-brightness-10" src={exclamation} />
                        <span className="text-white">{errorMessage || validationError}</span>
                    </div>
                )}
            </div>
            <div className="flex justify-end mt-6">
                <button onClick={() => save()} disabled={!!validationError || busy}>
                    Save
                </button>
            </div>
        </Modal>
    );
}
