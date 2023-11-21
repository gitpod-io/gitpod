/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PersonalAccessToken } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_pb";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { Redirect, useHistory, useParams } from "react-router";
import Alert from "../components/Alert";
import { CheckboxInputField, CheckboxListField } from "../components/forms/CheckboxInputField";
import DateSelector from "../components/DateSelector";
import { SpinnerOverlayLoader } from "../components/Loader";
import { personalAccessTokensService } from "../service/public-api";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { AllPermissions, TokenAction, TokenExpirationDays, TokenInfo } from "./PersonalAccessTokens";
import { settingsPathPersonalAccessTokens } from "./settings.routes";
import ShowTokenModal from "./ShowTokenModal";
import { Timestamp } from "@bufbuild/protobuf";
import arrowDown from "../images/sort-arrow.svg";
import { Heading2, Subheading } from "../components/typography/headings";
import { useFeatureFlag } from "../data/featureflag-query";
import { LinkButton } from "@podkit/buttons/LinkButton";
import { Button } from "@podkit/buttons/Button";

interface EditPATData {
    name: string;
    expirationDays: string;
    expirationDate: Date;
    scopes: Set<string>;
}

const personalAccessTokenNameRegex = /^[a-zA-Z0-9-_ ]{3,63}$/;

function PersonalAccessTokenCreateView() {
    const enablePersonalAccessTokens = useFeatureFlag("personalAccessTokensEnabled");

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (!enablePersonalAccessTokens) {
        return <Redirect to="/" />;
    }

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
                                <CheckboxListField label="Permission">
                                    {AllPermissions.map((item) => (
                                        <CheckboxInputField
                                            key={item.name}
                                            value={item.name}
                                            label={item.name}
                                            hint={item.description}
                                            checked={item.scopes.every((s) => token.scopes.has(s))}
                                            topMargin={false}
                                            onChange={(checked) => {
                                                if (checked) {
                                                    update({}, item.scopes);
                                                } else {
                                                    update({}, undefined, item.scopes);
                                                }
                                            }}
                                        />
                                    ))}
                                </CheckboxListField>
                            </div>
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
