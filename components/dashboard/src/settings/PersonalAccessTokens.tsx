/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PersonalAccessToken } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_pb";
import { useContext, useEffect, useState } from "react";
import { Redirect, useHistory, useLocation, useParams } from "react-router";
import { Link } from "react-router-dom";
import CheckBox from "../components/CheckBox";
import Modal from "../components/Modal";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { personalAccessTokensService } from "../service/public-api";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import {
    settingsPathPersonalAccessTokenCreate,
    settingsPathPersonalAccessTokens,
    settingsPathPersonalAccessTokenEdit,
} from "./settings.routes";
import arrowDown from "../images/sort-arrow.svg";
import { ReactComponent as ExclamationIcon } from "../images/exclamation.svg";
import { Timestamp } from "@bufbuild/protobuf";
import Alert from "../components/Alert";
import { InputWithCopy } from "../components/InputWithCopy";
import { copyToClipboard } from "../utils";
import { ContextMenuEntry } from "../components/ContextMenu";
import PillLabel from "../components/PillLabel";
import dayjs from "dayjs";
import { ItemFieldContextMenu } from "../components/ItemsList";
import { SpinnerLoader, SpinnerOverlayLoader } from "../components/Loader";

export default function PersonalAccessTokens() {
    const { enablePersonalAccessTokens } = useContext(FeatureFlagContext);

    if (!enablePersonalAccessTokens) {
        return <Redirect to="/" />;
    }

    return (
        <div>
            <PageWithSettingsSubMenu title="Access Tokens" subtitle="Manage your access tokens.">
                <ListAccessTokensView />
            </PageWithSettingsSubMenu>
        </div>
    );
}

const personalAccessTokenNameRegex = /^[a-zA-Z0-9-_ ]{3,63}$/;

enum TokenAction {
    Create = "CREATED",
    Regerenrate = "REGENERATED",
    Delete = "DELETE",
}

const TokenExpirationDays = [
    { value: "7", label: "7 Days" },
    { value: "30", label: "30 Days" },
    { value: "60", label: "60 Days" },
    { value: "180", label: "180 Days" },
];

interface PermissionDetail {
    name: string;
    description: string;
    scopes: string[];
}

const AllPermissions: PermissionDetail[] = [
    {
        name: "Full Access",
        description: "Grant complete read and write access to the API.",
        // TODO: what if scopes are duplicate? maybe use a key: uniq string; to filter will be better
        scopes: ["function:*", "resource:default"],
    },
];

interface DateSelectorProps {
    title: string;
    description: string;
    options: { value: string; label: string }[];
    value?: string;
    onChange: (value: string) => void;
}

function DateSelector(props: DateSelectorProps) {
    return (
        <div>
            <label htmlFor={props.title} className="font-semibold">
                {props.title}
            </label>
            <select name={props.title} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
                {props.options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            <p className="text-gray-500 dark:text-gray-400 mt-2">{props.description}</p>
        </div>
    );
}

interface TokenModalProps {
    token: PersonalAccessToken;
    title: string;
    description: string;
    descriptionImportant: string;
    actionDescription: string;
    showDateSelector?: boolean;
    onSave: (data: { expirationDate: Date }) => void;
    onClose: () => void;
}

function ShowTokenModal(props: TokenModalProps) {
    const [expiration, setExpiration] = useState({
        expirationDays: "30",
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const onEnter = () => {
        props.onSave({ expirationDate: expiration.expirationDate });
        return true;
    };

    return (
        <Modal
            title={props.title}
            buttons={[
                <button className="secondary" onClick={() => props.onClose()}>
                    Cancel
                </button>,
                <button className="danger" onClick={onEnter}>
                    {props.actionDescription}
                </button>,
            ]}
            visible={true}
            onClose={() => props.onClose()}
            onEnter={onEnter}
        >
            <div className="text-gray-500 dark:text-gray-400 text-md">
                <span>{props.description}</span> <span className="font-semibold">{props.descriptionImportant}</span>
            </div>
            <div className="p-4 mt-2 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className="font-semibold text-gray-700 dark:text-gray-200">{props.token.name}</div>
                <div className="font-medium text-gray-400 dark:text-gray-300">
                    Expires on {dayjs(props.token.expirationTime!.toDate()).format("MMM D, YYYY")}
                </div>
            </div>
            <div className="mt-4">
                {props.showDateSelector && (
                    <DateSelector
                        title="Expiration Date"
                        description={`The token will expire on ${dayjs(expiration.expirationDate).format(
                            "MMM D, YYYY",
                        )}`}
                        options={TokenExpirationDays}
                        value={TokenExpirationDays.find((i) => i.value === expiration.expirationDays)?.value}
                        onChange={(value) =>
                            setExpiration({
                                expirationDays: value,
                                expirationDate: new Date(Date.now() + Number(value) * 24 * 60 * 60 * 1000),
                            })
                        }
                    />
                )}
            </div>
        </Modal>
    );
}

interface EditPATData {
    name: string;
    expirationDays: string;
    expirationDate: Date;
    scopes: Set<string>;
}

export function PersonalAccessTokenCreateView() {
    const { enablePersonalAccessTokens } = useContext(FeatureFlagContext);

    const params = useParams<{ tokenId?: string }>();
    const history = useHistory<TokenInfo>();

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [editToken, setEditToken] = useState<PersonalAccessToken>();
    const [token, setToken] = useState<EditPATData>({
        name: "",
        expirationDays: "30",
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        scopes: new Set<string>(),
    });
    const [modalData, setModalData] = useState<{ token: PersonalAccessToken }>();

    const isEditing = !!params.tokenId;

    function backToListView(tokenInfo?: TokenInfo) {
        history.push({
            pathname: settingsPathPersonalAccessTokens,
            state: tokenInfo,
        });
    }

    useEffect(() => {
        (async () => {
            try {
                const { tokenId } = params;
                if (!tokenId) {
                    return;
                }

                setLoading(true);
                const resp = await personalAccessTokensService.getPersonalAccessToken({ id: tokenId });
                const token = resp.token!;
                setEditToken(token);
                update({
                    name: token.name,
                    scopes: new Set(token.scopes),
                });
            } catch (e) {
                setErrorMsg(e.message);
            }
            setLoading(false);
        })();
    }, []);

    const update = (change: Partial<EditPATData>, addScopes?: string[], removeScopes?: string[]) => {
        if (change.expirationDays) {
            change.expirationDate = new Date(Date.now() + Number(change.expirationDays) * 24 * 60 * 60 * 1000);
        }
        const data = { ...token, ...change };
        if (addScopes) {
            addScopes.forEach((s) => data.scopes.add(s));
        }
        if (removeScopes) {
            removeScopes.forEach((s) => data.scopes.delete(s));
        }
        setErrorMsg("");
        setToken(data);
    };

    const handleRegenerate = async (tokenId: string, expirationDate: Date) => {
        try {
            const resp = await personalAccessTokensService.regeneratePersonalAccessToken({
                id: tokenId,
                expirationTime: Timestamp.fromDate(expirationDate),
            });
            backToListView({ method: TokenAction.Regerenrate, data: resp.token! });
        } catch (e) {
            setErrorMsg(e.message);
        }
    };

    const handleConfirm = async () => {
        if (/^\s+/.test(token.name) || /\s+$/.test(token.name)) {
            setErrorMsg("Token name should not start or end with a space");
            return;
        }
        if (!personalAccessTokenNameRegex.test(token.name)) {
            setErrorMsg(
                "Token name should have a length between 3 and 63 characters, it can only contain letters, numbers, underscore and space characters",
            );
            return;
        }
        try {
            const resp = editToken
                ? await personalAccessTokensService.updatePersonalAccessToken({
                      token: {
                          id: editToken.id,
                          name: token.name,
                          scopes: Array.from(token.scopes),
                      },
                      updateMask: { paths: ["name", "scopes"] },
                  })
                : await personalAccessTokensService.createPersonalAccessToken({
                      token: {
                          name: token.name,
                          expirationTime: Timestamp.fromDate(token.expirationDate),
                          scopes: Array.from(token.scopes),
                      },
                  });

            backToListView(isEditing ? undefined : { method: TokenAction.Create, data: resp.token! });
        } catch (e) {
            setErrorMsg(e.message);
        }
    };

    if (!enablePersonalAccessTokens) {
        return <Redirect to="/" />;
    }

    return (
        <div>
            <PageWithSettingsSubMenu title="Access Tokens" subtitle="Manage your access tokens.">
                <div className="mb-4 flex gap-2">
                    <Link to={settingsPathPersonalAccessTokens}>
                        <button className="secondary">
                            <div className="flex place-content-center">
                                <img src={arrowDown} className="w-4 mr-2 transform rotate-90 mb-0" alt="Back arrow" />
                                <span>Back to list</span>
                            </div>
                        </button>
                    </Link>
                    {editToken && (
                        <button
                            className="danger bg-red-50 dark:bg-red-600 text-red-600 dark:text-red-50"
                            onClick={() => setModalData({ token: editToken })}
                        >
                            Regenerate
                        </button>
                    )}
                </div>
                <>
                    {errorMsg.length > 0 && (
                        <Alert type="error" className="mb-2 max-w-md">
                            {errorMsg}
                        </Alert>
                    )}
                </>
                <>
                    {modalData && (
                        <ShowTokenModal
                            token={modalData.token}
                            title="Regenerate Token"
                            description="Are you sure you want to regenerate this access token?"
                            descriptionImportant="Any applications using this token will no longer be able to access the Gitpod API."
                            actionDescription="Regenerate Token"
                            showDateSelector
                            onSave={({ expirationDate }) => handleRegenerate(modalData.token.id, expirationDate)}
                            onClose={() => setModalData(undefined)}
                        />
                    )}
                </>
                <SpinnerOverlayLoader content="loading access token" loading={loading}>
                    <div className="mb-6">
                        <div className="flex flex-col mb-4">
                            <h3>{isEditing ? "Edit" : "New"} Personal Access Token</h3>
                            {isEditing ? (
                                <h2 className="text-gray-500 dark:text-gray-400">
                                    Update token name, expiration date, permissions, or regenerate token.
                                </h2>
                            ) : (
                                <h2 className="text-gray-500 dark:text-gray-400">Create a new access token.</h2>
                            )}
                        </div>
                        <div className="flex flex-col gap-4">
                            <div>
                                <h4>Token Name</h4>
                                <input
                                    className="max-w-md"
                                    value={token.name}
                                    onChange={(e) => update({ name: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleConfirm();
                                        }
                                    }}
                                    type="text"
                                    placeholder="Token Name"
                                />
                                <p className="text-gray-500 dark:text-gray-400 mt-2">
                                    The application name using the token or the purpose of the token.
                                </p>
                            </div>
                            {!isEditing && (
                                <DateSelector
                                    title="Expiration Date"
                                    description={`The token will expire on ${dayjs(token.expirationDate).format(
                                        "MMM D, YYYY",
                                    )}`}
                                    options={TokenExpirationDays}
                                    value={TokenExpirationDays.find((i) => i.value === token.expirationDays)?.value}
                                    onChange={(value) => {
                                        update({ expirationDays: value });
                                    }}
                                />
                            )}
                            <div>
                                <h4>Permission</h4>
                                <div className="space-y-2">
                                    {AllPermissions.map((item) => (
                                        <CheckBox
                                            className=""
                                            title={item.name}
                                            desc={item.description}
                                            checked={item.scopes.every((s) => token.scopes.has(s))}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    update({}, item.scopes);
                                                } else {
                                                    update({}, undefined, item.scopes);
                                                }
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {isEditing && (
                            <Link to={settingsPathPersonalAccessTokens}>
                                <button className="secondary" onClick={handleConfirm}>
                                    Cancel
                                </button>
                            </Link>
                        )}
                        <button onClick={handleConfirm} disabled={isEditing && !editToken}>
                            {isEditing ? "Update" : "Create"} Personal Access Token
                        </button>
                    </div>
                </SpinnerOverlayLoader>
            </PageWithSettingsSubMenu>
        </div>
    );
}

interface TokenEntryProps {
    token: PersonalAccessToken;
    menuEntries: ContextMenuEntry[];
}

function TokenEntry(props: TokenEntryProps) {
    const expirationDay = dayjs(props.token.expirationTime!.toDate());
    const expired = expirationDay.isBefore(dayjs());

    const getScopes = () => {
        if (!props.token.scopes) {
            return "";
        }
        const permissions = AllPermissions.filter((e) => e.scopes.every((v) => props.token.scopes.includes(v)));
        if (permissions.length > 0) {
            return permissions.map((e) => e.name).join("\n");
        } else {
            return "No access";
        }
    };

    return (
        <>
            <div className="rounded-xl whitespace-nowrap flex space-x-2 py-4 px-4 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light group">
                <div className="flex items-center pr-3 w-4/12">
                    <span className="truncate">{props.token.name || ""}</span>
                </div>
                <div className="flex items-center w-4/12 text-gray-400 font-medium">
                    <span className="truncate whitespace-pre-line">{getScopes()}</span>
                </div>
                <div className="flex items-center w-3/12 text-gray-400">
                    <span className={"flex items-center gap-1 truncate" + (expired ? " text-orange-600" : "")}>
                        <span>{expirationDay.format("MMM D, YYYY")}</span>
                        {expired && <ExclamationIcon fill="#D97706" className="h-4 w-4" />}
                    </span>
                </div>
                <div className="flex items-center justify-end w-1/12">
                    <ItemFieldContextMenu menuEntries={props.menuEntries} />
                </div>
            </div>
        </>
    );
}

interface TokenInfo {
    method: TokenAction;
    data: PersonalAccessToken;
}

function ListAccessTokensView() {
    const location = useLocation();

    const [loading, setLoading] = useState<boolean>(false);
    const [tokens, setTokens] = useState<PersonalAccessToken[]>([]);
    const [tokenInfo, setTokenInfo] = useState<TokenInfo>();
    const [modalData, setModalData] = useState<{ token: PersonalAccessToken; action: TokenAction }>();
    const [errorMsg, setErrorMsg] = useState("");

    async function loadTokens() {
        try {
            setLoading(true);
            const response = await personalAccessTokensService.listPersonalAccessTokens({});
            setTokens(response.tokens);
        } catch (e) {
            setErrorMsg(e.message);
        }
        setLoading(false);
    }

    useEffect(() => {
        loadTokens();
    }, []);

    useEffect(() => {
        if (location.state) {
            setTokenInfo(location.state as any as TokenInfo);
            window.history.replaceState({}, "");
        }
    }, [location.state]);

    const handleCopyToken = () => {
        copyToClipboard(tokenInfo!.data.value);
    };

    const handleDeleteToken = async (tokenId: string) => {
        try {
            await personalAccessTokensService.deletePersonalAccessToken({ id: tokenId });
            if (tokenId === tokenInfo?.data.id) {
                setTokenInfo(undefined);
            }
            loadTokens();
            setModalData(undefined);
        } catch (e) {
            setErrorMsg(e.message);
        }
    };

    const handleRegenerateToken = async (tokenId: string, expirationDate: Date) => {
        try {
            const resp = await personalAccessTokensService.regeneratePersonalAccessToken({
                id: tokenId,
                expirationTime: Timestamp.fromDate(expirationDate),
            });
            setTokenInfo({ method: TokenAction.Regerenrate, data: resp.token! });
            loadTokens();
            setModalData(undefined);
        } catch (e) {
            setErrorMsg(e.message);
        }
    };

    return (
        <>
            <div className="flex items-center sm:justify-between mb-4">
                <div>
                    <h3>Personal Access Tokens</h3>
                    <h2 className="text-gray-500">Create or regenerate access tokens.</h2>
                </div>
                {tokens.length > 0 && (
                    <Link to={settingsPathPersonalAccessTokenCreate}>
                        <button>New Access Token</button>
                    </Link>
                )}
            </div>
            <>
                {errorMsg.length > 0 && (
                    <Alert type="error" className="mb-2">
                        {errorMsg}
                    </Alert>
                )}
            </>
            <>
                {tokenInfo && (
                    <>
                        <div className="p-4 mb-4 divide-y rounded-xl bg-gray-50 dark:bg-gray-800">
                            <div className="pb-2">
                                <div className="flex gap-2 content-center font-semibold text-gray-700 dark:text-gray-200">
                                    <span>{tokenInfo.data.name}</span>
                                    <PillLabel
                                        type={tokenInfo.method === TokenAction.Create ? "success" : "info"}
                                        className="py-0.5 px-1"
                                    >
                                        {tokenInfo.method.toUpperCase()}
                                    </PillLabel>
                                </div>
                                <div className="text-gray-400 dark:text-gray-300">
                                    <span>
                                        Expires on{" "}
                                        {dayjs(tokenInfo.data.expirationTime!.toDate()).format("MMM D, YYYY")}
                                    </span>
                                    <span> · </span>
                                    <span>
                                        Created on {dayjs(tokenInfo.data.createdAt!.toDate()).format("MMM D, YYYY")}
                                    </span>
                                </div>
                            </div>
                            <div className="pt-2">
                                <div className="font-semibold text-gray-600 dark:text-gray-200">
                                    Your New Access Token
                                </div>
                                <InputWithCopy
                                    className="my-2 max-w-md"
                                    value={tokenInfo.data.value}
                                    tip="Copy Token"
                                />
                                <div className="mb-2 font-medium text-sm text-gray-500 dark:text-gray-300">
                                    Make sure to copy your access token — you won't be able to access it again.
                                </div>
                                <button className="secondary" onClick={handleCopyToken}>
                                    Copy Token to Clipboard
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </>
            {loading ? (
                <SpinnerLoader content="loading access token list" />
            ) : (
                <>
                    {tokens.length === 0 ? (
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl w-full py-28 flex flex-col items-center">
                            <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">
                                No Access Tokens (PAT)
                            </h3>
                            <p className="text-center pb-6 text-gray-500 text-base w-96">
                                Generate a access token (PAT) for applications that need access to the Gitpod API.{" "}
                            </p>
                            <Link to={settingsPathPersonalAccessTokenCreate}>
                                <button>New Access Token</button>
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="px-3 py-3 flex justify-between space-x-2 text-sm text-gray-400 mb-2 bg-gray-100 dark:bg-gray-800 rounded-xl">
                                <h2 className="w-4/12">Token Name</h2>
                                <h2 className="w-4/12">Permissions</h2>
                                <h2 className="w-3/12">Expires</h2>
                                <div className="w-1/12"></div>
                            </div>
                            {tokens.map((t: PersonalAccessToken) => (
                                <TokenEntry
                                    key={t.id}
                                    token={t}
                                    menuEntries={[
                                        {
                                            title: "Edit",
                                            link: `${settingsPathPersonalAccessTokenEdit}/${t.id}`,
                                        },
                                        {
                                            title: "Regenerate",
                                            href: "",
                                            customFontStyle:
                                                "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
                                            onClick: () => setModalData({ token: t, action: TokenAction.Regerenrate }),
                                        },
                                        {
                                            title: "Delete",
                                            href: "",
                                            customFontStyle:
                                                "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
                                            onClick: () => setModalData({ token: t, action: TokenAction.Delete }),
                                        },
                                    ]}
                                />
                            ))}
                        </>
                    )}
                </>
            )}

            {modalData?.action === TokenAction.Delete && (
                <ShowTokenModal
                    token={modalData.token}
                    title="Delete Personal Access Token"
                    description="Are you sure you want to delete this personal access token?"
                    descriptionImportant="Any applications using this token will no longer be able to access the Gitpod API."
                    actionDescription="Delete Personal Access Token"
                    onSave={() => handleDeleteToken(modalData.token.id)}
                    onClose={() => setModalData(undefined)}
                />
            )}
            {modalData?.action === TokenAction.Regerenrate && (
                <ShowTokenModal
                    token={modalData.token}
                    title="Regenerate Token"
                    description="Are you sure you want to regenerate this personal access token?"
                    descriptionImportant="Any applications using this token will no longer be able to access the Gitpod API."
                    actionDescription="Regenerate Token"
                    showDateSelector
                    onSave={({ expirationDate }) => handleRegenerateToken(modalData.token.id, expirationDate)}
                    onClose={() => setModalData(undefined)}
                />
            )}
        </>
    );
}
