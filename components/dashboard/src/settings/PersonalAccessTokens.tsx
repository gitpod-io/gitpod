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
import { settingsPathPersonalAccessTokenCreate, settingsPathPersonalAccessTokens } from "./settings.routes";
import arrowDown from "../images/sort-arrow.svg";
import { Timestamp } from "@bufbuild/protobuf";
import Alert from "../components/Alert";
import { InputWithCopy } from "../components/InputWithCopy";
import { copyToClipboard } from "../utils";
import TokenEntry from "./TokenEntry";

function PersonalAccessTokens() {
    const { enablePersonalAccessTokens } = useContext(FeatureFlagContext);

    if (!enablePersonalAccessTokens) {
        return <Redirect to="/" />;
    }

    return (
        <div>
            <PageWithSettingsSubMenu title="Access Tokens" subtitle="Manage your personal access tokens.">
                <ListAccessTokensView />
            </PageWithSettingsSubMenu>
        </div>
    );
}

interface EditPATData {
    name: string;
    expirationDays: number;
    expirationDate: Date;
}

interface TokenModalProps {
    token: PersonalAccessToken;
    title: string;
    description: string;
    descriptionImportant: string;
    actionDescription: string;
    children?: React.ReactNode;
    onSave?: () => void;
    onClose?: () => void;
}

enum Method {
    Create = "CREATED",
    Regerenrate = "REGENERATED",
}

export function ShowTokenModal(props: TokenModalProps) {
    const onEnter = () => {
        if (props.onSave) {
            props.onSave();
        }
        return true;
    };

    return (
        <Modal
            title={props.title}
            buttons={[
                <button
                    className="secondary"
                    onClick={() => {
                        props.onClose && props.onClose();
                    }}
                >
                    Cancel
                </button>,
                <button className="danger" onClick={props.onSave}>
                    {props.actionDescription}
                </button>,
            ]}
            visible={true}
            onClose={() => {
                props.onClose && props.onClose();
            }}
            onEnter={onEnter}
        >
            <div className="text-gray-500 dark:text-gray-400 text-md">
                <span>{props.description}</span> <span className="font-semibold">{props.descriptionImportant}</span>
            </div>
            <div className="p-4 mt-2 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className="font-semibold text-gray-700 dark:text-gray-200">{props.token.name}</div>
                <div className="font-medium text-gray-400 dark:text-gray-300">
                    Expires on{" "}
                    {Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(props.token.expirationTime?.toDate())}
                </div>
            </div>
            {props.children ? <div className="p-4">{props.children}</div> : <></>}
        </Modal>
    );
}

export function PersonalAccessTokenCreateView() {
    const { enablePersonalAccessTokens } = useContext(FeatureFlagContext);

    const params = useParams();
    const history = useHistory<TokenInfo>();

    const [editTokenID, setEditTokenID] = useState<null | string>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [value, setValue] = useState<EditPATData>({
        name: "",
        expirationDays: 30,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const [showModal, setShowModal] = useState<boolean>(false);
    const [modalData, setModalData] = useState<PersonalAccessToken>();

    function backToListView(tokenInfo?: TokenInfo) {
        history.push({
            pathname: settingsPathPersonalAccessTokens,
            state: tokenInfo,
        });
    }

    useEffect(() => {
        (async () => {
            try {
                const { tokenId } = params as { tokenId: string };
                if (!tokenId) {
                    return;
                }
                setEditTokenID(tokenId);
                const resp = await personalAccessTokensService.getPersonalAccessToken({ id: tokenId });
                const token = resp.token;
                value.name = token!.name;
                setModalData(token!);
            } catch (e) {
                setErrorMsg(e.message);
            }
        })();
    }, []);

    const update = (change: Partial<EditPATData>) => {
        if (change.expirationDays) {
            change.expirationDate = new Date(Date.now() + change.expirationDays * 24 * 60 * 60 * 1000);
        }
        setErrorMsg("");
        setValue({ ...value, ...change });
    };

    const regenerate = async () => {
        if (!editTokenID) {
            return;
        }
        try {
            const resp = await personalAccessTokensService.regeneratePersonalAccessToken({
                id: editTokenID,
                expirationTime: Timestamp.fromDate(value.expirationDate),
            });
            backToListView({ method: Method.Regerenrate, data: resp.token! });
        } catch (e) {
            setErrorMsg(e.message);
        }
    };

    const handleConfirm = async () => {
        if (value.name.length < 3) {
            setErrorMsg("Token Name should have at least three characters.");
            return;
        }
        try {
            const resp = editTokenID
                ? await personalAccessTokensService.updatePersonalAccessToken({
                      token: {
                          id: editTokenID,
                          name: value.name,
                          scopes: ["function:*", "resource:default"],
                      },
                      updateMask: { paths: ["name", "scopes"] },
                  })
                : await personalAccessTokensService.createPersonalAccessToken({
                      token: {
                          name: value.name,
                          expirationTime: Timestamp.fromDate(value.expirationDate),
                          scopes: ["function:*", "resource:default"],
                      },
                  });

            backToListView(editTokenID ? undefined : { method: Method.Create, data: resp.token! });
        } catch (e) {
            setErrorMsg(e.message);
        }
    };

    if (!enablePersonalAccessTokens) {
        return <Redirect to="/" />;
    }

    return (
        <div>
            <PageWithSettingsSubMenu title="Access Tokens" subtitle="Manage your personal access tokens.">
                <div className="mb-4 flex gap-2">
                    <Link to={settingsPathPersonalAccessTokens}>
                        <button className="secondary">
                            <div className="flex place-content-center">
                                <img src={arrowDown} className="w-4 mr-2 transform rotate-90 mb-0" alt="Back arrow" />
                                <span>Back to list</span>
                            </div>
                        </button>
                    </Link>
                    {editTokenID && (
                        <button
                            className="danger bg-red-50 dark:bg-red-600 text-red-600 dark:text-red-50"
                            onClick={() => setShowModal(true)}
                        >
                            Regenerate
                        </button>
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
                    {showModal && (
                        <ShowTokenModal
                            token={modalData!}
                            title="Regenerate Token"
                            description="Are you sure you want to regenerate this personal access token?"
                            descriptionImportant="Any applications using this token will no longer be able to access the Gitpod API."
                            actionDescription="Regenerate Token"
                            onSave={() => {
                                regenerate();
                            }}
                            onClose={() => {
                                setShowModal(false);
                            }}
                        >
                            <div>
                                <h4>Expiration Date</h4>
                                <select
                                    name="expiration"
                                    value={value.expirationDays}
                                    onChange={(e) => {
                                        update({ expirationDays: Number(e.target.value) });
                                    }}
                                >
                                    <option value="30">30 Days</option>
                                    <option value="90">90 Days</option>
                                    <option value="180">180 Days</option>
                                </select>
                                <p className="text-gray-500 dark:text-gray-400 mt-2">
                                    The token will expire on{" "}
                                    {Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(value.expirationDate)}.
                                </p>
                            </div>
                        </ShowTokenModal>
                    )}
                </>
                <div className="max-w-md mb-6">
                    <div className="flex flex-col mb-4">
                        <h3>{editTokenID ? "Edit" : "New"} Personal Access Token</h3>
                        {editTokenID ? (
                            <>
                                <h2 className="text-gray-500 dark:text-gray-400 dark:text-gray-400">
                                    Update token name, expiration date, permissions, or regenerate token.
                                </h2>
                            </>
                        ) : (
                            <>
                                <h2 className="text-gray-500 dark:text-gray-400">
                                    Create a new personal access token.
                                </h2>
                            </>
                        )}
                    </div>
                    <div className="flex flex-col gap-4">
                        <div>
                            <h4>Token Name</h4>
                            <input
                                className="w-full"
                                value={value.name}
                                onChange={(e) => {
                                    update({ name: e.target.value });
                                }}
                                type="text"
                                placeholder="Token Name"
                            />
                            <p className="text-gray-500 dark:text-gray-400 mt-2">
                                The application name using the token or the purpose of the token.
                            </p>
                        </div>
                        {!editTokenID && (
                            <div>
                                <h4>Expiration Date</h4>
                                <select
                                    name="expiration"
                                    value={value.expirationDays}
                                    onChange={(e) => {
                                        update({ expirationDays: Number(e.target.value) });
                                    }}
                                >
                                    <option value="7">7 Days</option>
                                    <option value="30">30 Days</option>
                                    <option value="90">90 Days</option>
                                    <option value="180">180 Days</option>
                                </select>
                                <p className="text-gray-500 dark:text-gray-400 mt-2">
                                    The token will expire on{" "}
                                    {Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(value.expirationDate)}.
                                </p>
                            </div>
                        )}
                        <div>
                            <h4>Permission</h4>
                            <CheckBox
                                className=""
                                title="Access the user's API"
                                desc="Grant complete read and write access to the API."
                                checked={true}
                                disabled={true}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {editTokenID && (
                        <Link to={settingsPathPersonalAccessTokens}>
                            <button className="secondary" onClick={handleConfirm}>
                                Cancel
                            </button>
                        </Link>
                    )}
                    <button onClick={handleConfirm}>{editTokenID ? "Update" : "Create"} Personal Access Token</button>
                </div>
            </PageWithSettingsSubMenu>
        </div>
    );
}

interface TokenInfo {
    method: Method;
    data: PersonalAccessToken;
}

function ListAccessTokensView() {
    const location = useLocation();

    const [tokens, setTokens] = useState<PersonalAccessToken[]>([]);
    const [tokenInfo, setTokenInfo] = useState<TokenInfo>();

    async function loadTokens() {
        const response = await personalAccessTokensService.listPersonalAccessTokens({});
        setTokens(response.tokens);
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

    const handleDeleteToken = (tokenId: string) => {
        if (tokenId === tokenInfo?.data.id) {
            setTokenInfo(undefined);
        }
        loadTokens();
    };

    return (
        <>
            <div className="flex items-center sm:justify-between mb-4">
                <div>
                    <h3>Personal Access Tokens</h3>
                    <h2 className="text-gray-500">Create or regenerate active personal access tokens.</h2>
                </div>
                {tokens.length > 0 && (
                    <Link to={settingsPathPersonalAccessTokenCreate}>
                        <button>New Personal Access Token</button>
                    </Link>
                )}
            </div>
            <>
                {tokenInfo && (
                    <>
                        <div className="p-4 mb-4 divide-y rounded-xl bg-gray-50 dark:bg-gray-800">
                            <div className="pb-2">
                                <div className="flex gap-2 content-center font-semibold text-gray-700 dark:text-gray-200">
                                    <span className="ml-1">{tokenInfo.data.name}</span>
                                    <span
                                        className={
                                            "font-medium px-1 py-1 rounded-full text-xs" +
                                            (tokenInfo.method === Method.Create
                                                ? " text-green-600 bg-green-100"
                                                : " text-blue-600 bg-blue-100")
                                        }
                                    >
                                        {tokenInfo.method.toUpperCase()}
                                    </span>
                                </div>
                                <div className="font-medium text-gray-400 dark:text-gray-300">
                                    <span>
                                        Expires on{" "}
                                        {Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
                                            tokenInfo.data.expirationTime?.toDate(),
                                        )}
                                    </span>
                                    <span> • </span>
                                    <span>
                                        Created on{" "}
                                        {Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
                                            tokenInfo.data.createdAt?.toDate(),
                                        )}
                                    </span>
                                </div>
                            </div>
                            <div className="pt-2">
                                <div className="font-semibold text-gray-600 dark:text-gray-200">
                                    Your New Personal Access Token
                                </div>
                                <InputWithCopy
                                    className="my-2 max-w-md"
                                    value={tokenInfo.data.value}
                                    tip="Copy Token"
                                />
                                <div className="mb-2 font-medium text-sm text-gray-500 dark:text-gray-300">
                                    Make sure to copy your personal access token — you won't be able to access it again.
                                </div>
                                <button className="secondary" onClick={handleCopyToken}>
                                    Copy Token to Clipboard
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </>
            {tokens.length === 0 ? (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl w-full py-28 flex flex-col items-center">
                    <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">
                        No Personal Access Tokens (PAT)
                    </h3>
                    <p className="text-center pb-6 text-gray-500 text-base w-96">
                        Generate a personal access token (PAT) for applications that need access to the Gitpod API.{" "}
                    </p>
                    <Link to={settingsPathPersonalAccessTokenCreate}>
                        <button>New Personal Access Token</button>
                    </Link>
                </div>
            ) : (
                <>
                    <div className="px-6 py-3 flex justify-between space-x-2 text-sm text-gray-400 mb-2 bg-gray-100 dark:bg-gray-800 rounded-xl">
                        <h2 className="w-3/12">Token Name</h2>
                        <h2 className="w-3/12">Permissions</h2>
                        <h2 className="w-3/12">Expires</h2>
                        <div className="w-3/12"></div>
                    </div>
                    {tokens.map((t: PersonalAccessToken) => {
                        return <TokenEntry token={t} onDelete={handleDeleteToken} />;
                    })}
                </>
            )}
        </>
    );
}

export default PersonalAccessTokens;
