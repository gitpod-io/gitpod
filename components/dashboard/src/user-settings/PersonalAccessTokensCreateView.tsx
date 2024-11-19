/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PersonalAccessToken } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_pb";
import { useEffect, useMemo, useState } from "react";
import { useHistory, useParams } from "react-router";
import Alert from "../components/Alert";
import DateSelector from "../components/DateSelector";
import { SpinnerOverlayLoader } from "../components/Loader";
import { personalAccessTokensService } from "../service/public-api";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import {
    AllPermissions,
    TokenAction,
    getTokenExpirationDays,
    TokenInfo,
    getTokenExpirationDescription,
} from "./PersonalAccessTokens";
import { settingsPathPersonalAccessTokens } from "./settings.routes";
import ShowTokenModal from "./ShowTokenModal";
import { Timestamp } from "@bufbuild/protobuf";
import arrowDown from "../images/sort-arrow.svg";
import { Heading2, Subheading } from "../components/typography/headings";
import { useIsDataOps } from "../data/featureflag-query";
import { LinkButton } from "@podkit/buttons/LinkButton";
import { Button } from "@podkit/buttons/Button";
import { TextInputField } from "../components/forms/TextInputField";

interface EditPATData {
    name: string;
    expirationValue: string;
    expirationDate: Date;
    scopes: Set<string>;
}

const personalAccessTokenNameRegex = /^[a-zA-Z0-9-_ ]{3,63}$/;

function PersonalAccessTokenCreateView() {
    const params = useParams<{ tokenId?: string }>();
    const history = useHistory<TokenInfo>();

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [editToken, setEditToken] = useState<PersonalAccessToken>();
    const [token, setToken] = useState<EditPATData>({
        name: "",
        expirationValue: "30 Days",
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // default option 30 days
        scopes: new Set<string>(AllPermissions[0].scopes), // default to all permissions
    });
    const [modalData, setModalData] = useState<{ token: PersonalAccessToken }>();

    const isEditing = !!params.tokenId;

    function backToListView(tokenInfo?: TokenInfo) {
        history.push({
            pathname: settingsPathPersonalAccessTokens,
            state: tokenInfo,
        });
    }

    const isDataOps = useIsDataOps();
    const TokenExpirationDays = useMemo(() => getTokenExpirationDays(isDataOps), [isDataOps]);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const update = (change: Partial<EditPATData>, addScopes?: string[], removeScopes?: string[]) => {
        if (change.expirationValue) {
            const found = TokenExpirationDays.find((e) => e.value === change.expirationValue);
            change.expirationDate = found?.getDate();
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
            backToListView({ method: TokenAction.Regenerate, data: resp.token! });
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

    return (
        <div>
            <PageWithSettingsSubMenu>
                <div className="mb-4 flex gap-2">
                    <LinkButton variant="secondary" href={settingsPathPersonalAccessTokens}>
                        <img src={arrowDown} className="w-4 mr-2 transform rotate-90 mb-0" alt="Back arrow" />
                        <span>Back to list</span>
                    </LinkButton>
                    {editToken && (
                        <Button variant="destructive" onClick={() => setModalData({ token: editToken })}>
                            Regenerate
                        </Button>
                    )}
                </div>
                {errorMsg.length > 0 && (
                    <Alert type="error" className="mb-2 max-w-md">
                        {errorMsg}
                    </Alert>
                )}
                {!editToken && (
                    <Alert type={"warning"} closable={false} showIcon={true} className="my-4 max-w-lg">
                        This token will have complete read / write access to the API. Use it responsibly and revoke it
                        if necessary.
                    </Alert>
                )}
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
                <SpinnerOverlayLoader content="loading access token" loading={loading}>
                    <div className="mb-6">
                        <div className="flex flex-col mb-4">
                            <Heading2>{isEditing ? "Edit" : "New"} Access Token</Heading2>
                            {isEditing ? (
                                <Subheading>
                                    Update token name, expiration date, permissions, or regenerate token.
                                </Subheading>
                            ) : (
                                <Subheading>Create a new access token.</Subheading>
                            )}
                        </div>
                        <div className="flex flex-col gap-4">
                            <TextInputField
                                label="Token Name"
                                placeholder="Token Name"
                                hint="The application name using the token or the purpose of the token."
                                value={token.name}
                                type="text"
                                className="max-w-md"
                                onChange={(val) => update({ name: val })}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleConfirm();
                                    }
                                }}
                            />

                            {!isEditing && (
                                <DateSelector
                                    title="Expiration Date"
                                    description={getTokenExpirationDescription(token.expirationDate)}
                                    options={TokenExpirationDays}
                                    value={TokenExpirationDays.find((i) => i.value === token.expirationValue)?.value}
                                    onChange={(value) => {
                                        update({ expirationValue: value });
                                    }}
                                />
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {isEditing && (
                            <LinkButton variant="secondary" href={settingsPathPersonalAccessTokens}>
                                Cancel
                            </LinkButton>
                        )}
                        <Button onClick={handleConfirm} disabled={isEditing && !editToken}>
                            {isEditing ? "Update" : "Create"} Access Token
                        </Button>
                    </div>
                </SpinnerOverlayLoader>
            </PageWithSettingsSubMenu>
        </div>
    );
}

export default PersonalAccessTokenCreateView;
