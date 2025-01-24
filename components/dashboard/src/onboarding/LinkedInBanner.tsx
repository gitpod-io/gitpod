/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import classNames from "classnames";
import { FC } from "react";
import { useLinkedIn } from "react-linkedin-login-oauth2";
import Alert from "../components/Alert";
import { Button } from "@podkit/buttons/Button";
import SignInWithLinkedIn from "../images/sign-in-with-linkedin.svg";
import { getGitpodService } from "../service/service";
import { LinkedInProfile } from "@gitpod/gitpod-protocol";
import { useToast } from "../components/toasts/Toasts";

type Props = {
    onSuccess(profile: LinkedInProfile): void;
};
export const LinkedInBanner: FC<Props> = ({ onSuccess }) => {
    const { toast } = useToast();
    const {
        data: clientID,
        isLoading,
        isError,
    } = useQuery(
        ["linkedin-clientid"],
        async () => {
            return (await getGitpodService().server.getLinkedInClientId()) || "";
        },
        { enabled: true },
    );

    const { linkedInLogin } = useLinkedIn({
        clientId: clientID || "",
        redirectUri: `${window.location.origin}/linkedin`,
        scope: "r_liteprofile r_emailaddress",
        onSuccess: (code) => {
            getGitpodService()
                .server.connectWithLinkedIn(code)
                .then((profile) => {
                    onSuccess(profile);
                })
                .catch((error) => {
                    console.error("LinkedIn connection failed", error);

                    toast(
                        <>
                            <span>Error connecting with LinkedIn</span>
                            {error.message && <pre className="mt-2 whitespace-normal text-xs">{error.message}</pre>}
                        </>,
                    );
                });
        },
        onError: (error) => {
            console.error("error", error);
        },
    });

    return (
        <>
            <div
                className={classNames(
                    "mt-6 p-6",
                    "border-2 border-dashed rounded-md space-y-4",
                    "bg-pk-surface-secondary dark:border-gray-600",
                )}
            >
                <div className="flex items-center justify-center space-x-6">
                    <span className="text-4xl">🎁</span>
                    {/* TODO: Shouldn't need a fixed width here, but was hard to center otherwise  */}
                    <p className="w-64 text-base text-gray-500 dark:text-gray-100">
                        Receive <strong>50 hours</strong> of usage per month by connecting your{" "}
                        <strong>LinkedIn</strong> account.
                    </p>
                </div>
                <Button
                    className="gap-2 w-full"
                    onClick={(event) => {
                        event.preventDefault();
                        linkedInLogin();
                    }}
                    disabled={isLoading || !clientID}
                >
                    <img src={SignInWithLinkedIn} width={20} height={20} alt="" /> Connect with LinkedIn
                </Button>
            </div>
            {/* TODO: Figure out if there's a different way we want to handle an error getting the clientID */}
            {isError && (
                <Alert className="mt-4" type="error">
                    We're sorry, there was a problem with the LinkedIn connection.
                </Alert>
            )}
        </>
    );
};
