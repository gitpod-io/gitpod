/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { FC, useCallback, useContext } from "react";
import { Link } from "react-router-dom";
import { useAuthProviders } from "../data/auth-providers/auth-provider-query";
import { openAuthorizeWindow } from "../provider-utils";
import { getGitpodService } from "../service/service";
import { UserContext, useCurrentUser } from "../user-context";
import { Button } from "./Button";
import { Heading2, Heading3, Subheading } from "./typography/headings";
import classNames from "classnames";
import { iconForAuthProvider, simplifyProviderName } from "../provider-utils";
import { useIsOwner } from "../data/organizations/members-query";

export function useNeedsGitAuthorization() {
    const authProviders = useAuthProviders();
    const user = useCurrentUser();
    if (!user || !authProviders.data) {
        return false;
    }
    return !authProviders.data.some((ap) => user.identities.some((i) => ap.authProviderId === i.authProviderId));
}

export const AuthorizeGit: FC<{ className?: string }> = ({ className }) => {
    const { setUser } = useContext(UserContext);
    const owner = useIsOwner();
    const authProviders = useAuthProviders();
    const updateUser = useCallback(() => {
        getGitpodService().server.getLoggedInUser().then(setUser);
    }, [setUser]);

    const connect = useCallback(
        (ap: AuthProviderInfo) => {
            openAuthorizeWindow({
                host: ap.host,
                scopes: ap.requirements?.default,
                overrideScopes: true,
                onSuccess: updateUser,
            });
        },
        [updateUser],
    );

    if (authProviders.data === undefined) {
        return <></>;
    }

    const verifiedProviders = authProviders.data.filter((ap) => ap.verified);

    return (
        <div className={classNames("text-center p-4 m-4 py-10", className)}>
            {verifiedProviders.length === 0 ? (
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
                        {verifiedProviders.map((ap) => {
                            return (
                                <Button
                                    onClick={() => connect(ap)}
                                    type="secondary"
                                    key={"button" + ap.host}
                                    className="mt-3 btn-login flex-none w-56 px-0 py-0.5 inline-flex"
                                >
                                    <div className="flex relative -left-4 w-56">
                                        {iconForAuthProvider(ap.authProviderType)}
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
