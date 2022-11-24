/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PersonalAccessToken } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_pb";
import { useContext, useEffect, useState } from "react";
import { Redirect, useHistory, useLocation } from "react-router";
import { Link } from "react-router-dom";
import CheckBox from "../components/CheckBox";
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

export function PersonalAccessTokenCreateView() {
    const { enablePersonalAccessTokens } = useContext(FeatureFlagContext);

    const history = useHistory();
    const [errorMsg, setErrorMsg] = useState("");
    const [value, setValue] = useState<EditPATData>({
        name: "",
        expirationDays: 30,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const update = (change: Partial<EditPATData>) => {
        if (change.expirationDays) {
            change.expirationDate = new Date(Date.now() + change.expirationDays * 24 * 60 * 60 * 1000);
        }
        setErrorMsg("");
        setValue({ ...value, ...change });
    };

    const createToken = async () => {
        if (value.name.length < 3) {
            setErrorMsg("Token Name should have at least three characters.");
            return;
        }
        try {
            const resp = await personalAccessTokensService.createPersonalAccessToken({
                token: {
                    name: value.name,
                    expirationTime: Timestamp.fromDate(value.expirationDate),
                    scopes: ["function:*", "resource:default"],
                },
            });
            history.push({
                pathname: settingsPathPersonalAccessTokens,
                state: {
                    method: "CREATED",
                    data: resp.token,
                },
            });
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
                <div className="mb-4">
                    <Link to={settingsPathPersonalAccessTokens}>
                        <button className="secondary">
                            <div className="flex place-content-center">
                                <img src={arrowDown} className="w-4 mr-2 transform rotate-90 mb-0" alt="Back arrow" />
                                <span>Back to list</span>
                            </div>
                        </button>
                    </Link>
                </div>
                <>
                    {errorMsg.length > 0 && (
                        <Alert type="error" className="mb-2">
                            {errorMsg}
                        </Alert>
                    )}
                </>
                <div className="max-w-md mb-6">
                    <div className="flex flex-col mb-4">
                        <h3>New Personal Access Token</h3>
                        <h2 className="text-gray-500">Create a new personal access token.</h2>
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
                            <p className="text-gray-500 mt-2">
                                The application name using the token or the purpose of the token.
                            </p>
                        </div>
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
                            <p className="text-gray-500 mt-2">
                                The token will expire on{" "}
                                {Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(value.expirationDate)}.
                            </p>
                        </div>
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
                <button onClick={createToken}>Create Personal Access Token</button>
            </PageWithSettingsSubMenu>
        </div>
    );
}

interface TokenInfo {
    method: string;
    data: PersonalAccessToken;
}

function ListAccessTokensView() {
    const location = useLocation();

    const [tokens, setTokens] = useState<PersonalAccessToken[]>([]);
    const [tokenInfo, setTokenInfo] = useState<TokenInfo>();

    useEffect(() => {
        (async () => {
            const response = await personalAccessTokensService.listPersonalAccessTokens({});
            setTokens(response.tokens);
        })();
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
                        <div className="p-4 mb-4 divide-y rounded-xl bg-gray-100 dark:bg-gray-700">
                            <div className="pb-2">
                                <div className="font-semibold text-gray-700 dark:text-gray-200">
                                    {tokenInfo.data.name}{" "}
                                    <span className="px-2 py-1 rounded-full text-sm text-green-600 bg-green-100">
                                        {tokenInfo.method.toUpperCase()}
                                    </span>
                                </div>
                                <div className="font-semibold text-gray-400 dark:text-gray-300">
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
                                <div className="text-gray-600 font-semibold">Your New Personal Access Token</div>
                                <InputWithCopy
                                    className="my-2 max-w-md"
                                    value={tokenInfo.data.value}
                                    tip="Copy Token"
                                />
                                <div className="mb-2 text-gray-500 font-medium text-sm">
                                    Make sure to copy your personal access token — you won't be able to access it again.
                                </div>
                                <button className="secondary" onClick={handleCopyToken}>
                                    Copy Token To Clipboard
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
                    <div className="px-6 py-3 flex justify-between space-x-2 text-sm text-gray-400 mb-2 bg-gray-100 rounded-xl">
                        <h2 className="w-3/12">Token Name</h2>
                        <h2 className="w-3/12">Permissions</h2>
                        <h2 className="w-3/12">Expires</h2>
                        <div className="w-3/12"></div>
                    </div>
                    {tokens.map((t: PersonalAccessToken) => {
                        return <TokenEntry token={t} />;
                    })}
                </>
            )}
        </>
    );
}

export default PersonalAccessTokens;
