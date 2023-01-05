/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PersonalAccessToken } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_pb";
import { useContext, useEffect, useState } from "react";
import { Redirect, useLocation } from "react-router";
import { Link } from "react-router-dom";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { personalAccessTokensService } from "../service/public-api";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { settingsPathPersonalAccessTokenCreate, settingsPathPersonalAccessTokenEdit } from "./settings.routes";
import { Timestamp } from "@bufbuild/protobuf";
import Alert from "../components/Alert";
import { InputWithCopy } from "../components/InputWithCopy";
import { copyToClipboard } from "../utils";
import PillLabel from "../components/PillLabel";
import dayjs from "dayjs";
import { SpinnerLoader } from "../components/Loader";
import TokenEntry from "./TokenEntry";
import ShowTokenModal from "./ShowTokenModal";
import Pagination from "../Pagination/Pagination";

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

export enum TokenAction {
    Create = "CREATED",
    Regenerate = "REGENERATED",
    Delete = "DELETE",
}

export const TokenExpirationDays = [
    { value: "7", label: "7 Days" },
    { value: "30", label: "30 Days" },
    { value: "60", label: "60 Days" },
    { value: "180", label: "180 Days" },
];

export const AllPermissions: PermissionDetail[] = [
    {
        name: "Full Access",
        description: "Grant complete read and write access to the API.",
        // TODO: what if scopes are duplicate? maybe use a key: uniq string; to filter will be better
        scopes: ["function:*", "resource:default"],
    },
];

export interface TokenInfo {
    method: TokenAction;
    data: PersonalAccessToken;
}

interface PermissionDetail {
    name: string;
    description: string;
    scopes: string[];
}

function ListAccessTokensView() {
    const location = useLocation();

    const [loading, setLoading] = useState<boolean>(false);
    const [tokens, setTokens] = useState<PersonalAccessToken[]>([]);
    const [tokenInfo, setTokenInfo] = useState<TokenInfo>();
    const [modalData, setModalData] = useState<{ token: PersonalAccessToken; action: TokenAction }>();
    const [errorMsg, setErrorMsg] = useState("");
    const [totalResults, setTotalResults] = useState<number>();
    const pageLength = 25;
    const [currentPage, setCurrentPage] = useState<number>(1);

    async function loadTokens() {
        try {
            setLoading(true);
            const response = await personalAccessTokensService.listPersonalAccessTokens({
                pagination: { pageSize: pageLength, page: currentPage },
            });
            setTokens(response.tokens);
            setTotalResults(Number(response.totalResults));
        } catch (e) {
            setErrorMsg(e.message);
        }
        setLoading(false);
    }

    useEffect(() => {
        loadTokens();
    }, [currentPage]);

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
            setTokenInfo({ method: TokenAction.Regenerate, data: resp.token! });
            loadTokens();
            setModalData(undefined);
        } catch (e) {
            setErrorMsg(e.message);
        }
    };

    const loadPage = (page: number = 1) => {
        setCurrentPage(page);
    };

    return (
        <>
            <div className="flex items-center sm:justify-between mb-4">
                <div>
                    <h3>
                        Access Tokens{" "}
                        <PillLabel type="warn" className="font-semibold self-center py-0.5 px-1.5">
                            <a href="https://www.gitpod.io/docs/references/gitpod-releases">
                                <span className="text-xs">BETA</span>
                            </a>
                        </PillLabel>
                    </h3>
                    <h2 className="text-gray-500">
                        Create or regenerate access tokens.{" "}
                        <a
                            className="gp-link"
                            href="https://www.gitpod.io/docs/configure/user-settings/access-tokens"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Learn more
                        </a>
                        &nbsp;&middot;&nbsp;
                        <a
                            className="gp-link"
                            href="https://github.com/gitpod-io/gitpod/issues/15433"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Send feedback
                        </a>
                    </h2>
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
                            <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">No Access Tokens</h3>
                            <p className="text-center pb-6 text-gray-500 text-base w-96">
                                Generate an access token for applications that need access to the Gitpod API.{" "}
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
                                            onClick: () => setModalData({ token: t, action: TokenAction.Regenerate }),
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
                            {totalResults && (
                                <Pagination
                                    totalNumberOfPages={Math.ceil(totalResults / pageLength)}
                                    currentPage={currentPage}
                                    setPage={loadPage}
                                />
                            )}
                        </>
                    )}
                </>
            )}

            {modalData?.action === TokenAction.Delete && (
                <ShowTokenModal
                    token={modalData.token}
                    title="Delete Access Token"
                    description="Are you sure you want to delete this access token?"
                    descriptionImportant="Any applications using this token will no longer be able to access the Gitpod API."
                    actionDescription="Delete Access Token"
                    onSave={() => handleDeleteToken(modalData.token.id)}
                    onClose={() => setModalData(undefined)}
                />
            )}
            {modalData?.action === TokenAction.Regenerate && (
                <ShowTokenModal
                    token={modalData.token}
                    title="Regenerate Token"
                    description="Are you sure you want to regenerate this access token?"
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
