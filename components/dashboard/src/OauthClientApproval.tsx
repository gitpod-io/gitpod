/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Button } from "@podkit/buttons/Button";
import gitpodIcon from "./icons/gitpod.svg";
import { Heading1, Subheading } from "@podkit/typography/Headings";
import { isTrustedUrlOrPath } from "./utils";

export default function OAuthClientApproval() {
    const params = new URLSearchParams(window.location.search);
    const clientName = params.get("clientName") || "";

    let redirectTo = "/";
    const returnToPath = params.get("returnToPath");
    if (returnToPath) {
        const isAbsoluteURL = /^https?:\/\//i.test(returnToPath);
        if (!isAbsoluteURL) {
            redirectTo = returnToPath;
        }
    }
    const updateClientApproval = async (isApproved: boolean) => {
        if (redirectTo === "/") {
            window.location.replace(redirectTo);
            return;
        }
        const url = `${redirectTo}&approved=${isApproved ? "yes" : "no"}`;
        if (isTrustedUrlOrPath(url)) {
            window.location.replace(url);
        }
    };

    return (
        <div id="oauth-container" className="z-50 flex w-screen h-screen">
            <div id="oauth-section" className="flex-grow flex w-full">
                <div id="oauth-section-column" className="flex-grow max-w-2xl flex flex-col h-100 mx-auto">
                    <div className="flex-grow h-100 flex flex-row items-center justify-center">
                        <div className="rounded-xl px-10 py-10 mx-auto">
                            <div className="mx-auto pb-8">
                                <img src={gitpodIcon} className="h-16 mx-auto" alt="Gitpod's logo" />
                            </div>
                            <div className="mx-auto text-center pb-8 space-y-2">
                                <Heading1>Authorize {clientName}</Heading1>
                                <Subheading>
                                    You are about to authorize {clientName} to access your Gitpod account including data
                                    for all workspaces.
                                </Subheading>
                            </div>
                            <div className="flex justify-center mt-6">
                                <Button variant="secondary" onClick={() => updateClientApproval(false)}>
                                    Cancel
                                </Button>
                                <Button key={"button-yes"} className="ml-2" onClick={() => updateClientApproval(true)}>
                                    Authorize
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
