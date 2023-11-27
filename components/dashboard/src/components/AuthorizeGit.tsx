/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuthProviderDescriptions } from "../data/auth-providers/auth-provider-descriptions-query";
import { openAuthorizeWindow } from "../provider-utils";
import { Button } from "./Button";
import { Heading2, Heading3, Subheading } from "./typography/headings";
import classNames from "classnames";
import { iconForAuthProvider, simplifyProviderName } from "../provider-utils";
import { useIsOwner } from "../data/organizations/members-query";
import { AuthProviderDescription } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { useAuthenticatedUser } from "../data/current-user/authenticated-user-query";

export function useNeedsGitAuthorization() {
    const { data: user } = useAuthenticatedUser();
    const { data: authProviders } = useAuthProviderDescriptions();
    if (!user || !authProviders) {
        return false;
    }
    return !authProviders.some((ap) => user.identities.some((i) => ap.id === i.authProviderId));
}

export const AuthorizeGit: FC<{ className?: string }> = ({ className }) => {
    const { refetch: reloadUser } = useAuthenticatedUser();
    const owner = useIsOwner();
    const { data: authProviders } = useAuthProviderDescriptions();
    const updateUser = useCallback(async () => {
        await reloadUser();
    }, [reloadUser]);

    const connect = useCallback(
        (ap: AuthProviderDescription) => {
            openAuthorizeWindow({
                host: ap.host,
                overrideScopes: true,
                onSuccess: updateUser,
            });
        },
        [updateUser],
    );

    if (authProviders === undefined) {
        return <></>;
    }

    return (
        <div className={classNames("text-center p-4 m-4 py-10", className)}>
            {authProviders.length === 0 ? (
                <>
                    <Heading3 className="pb-2">No Git integrations</Heading3>
                    {!!owner ? (
                        <div className="px-6">
                            <Subheading>You need to configure at least one Git integration.</Subheading>
                            <Link to="/settings/git">
                                <Button className="mt-6 w-full">Add a Git integration</Button>
                            </Link>
                        </div>
                    ) : (
                        <>
                            <Subheading>
                                An organization owner needs to configure at least one Git integration.{" "}
                                <Link className="gp-link" to="/members">
                                    View organization members
                                </Link>
                            </Subheading>
                        </>
                    )}
                </>
            ) : (
                <>
                    <Heading2 className="pb-6">Authorize Git</Heading2>
                    <Subheading className="mb-6">
                        Select one of the following available providers to access repositories for your account.
                    </Subheading>
                    <div className="flex flex-col items-center">
                        {authProviders.map((ap) => {
                            return (
                                <Button
                                    onClick={() => connect(ap)}
                                    type="secondary"
                                    key={"button" + ap.host}
                                    className="mt-3 btn-login flex-none w-56 px-0 py-0.5 inline-flex"
                                >
                                    <div className="flex relative -left-4 w-56">
                                        {iconForAuthProvider(ap.type)}
                                        <span className="pt-2 pb-2 mr-3 text-sm my-auto font-medium truncate overflow-ellipsis">
                                            Continue with {simplifyProviderName(ap.host)}
                                        </span>
                                    </div>
                                </Button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};
