/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import gitpodIcon from './icons/gitpod.svg';
import { getSafeURLRedirect } from "./provider-utils";

export default function OAuthClientApproval() {
    const params = new URLSearchParams(window.location.search);
    const clientName = params.get("clientName") || "";
    let redirectToParam = params.get("redirectTo") || undefined;
    if (redirectToParam) {
        redirectToParam = decodeURIComponent(redirectToParam);
    }
    const redirectTo = getSafeURLRedirect(redirectToParam) || "/";
    const updateClientApproval = async (isApproved: boolean) => {
        if (redirectTo === "/") {
            window.location.replace(redirectTo);
        }
        window.location.replace(`${redirectTo}&approved=${isApproved ? 'yes' : 'no'}`);
    }

    return (<div id="oauth-container" className="z-50 flex w-screen h-screen">
        <div id="oauth-section" className="flex-grow flex w-full">
            <div id="oauth-section-column" className="flex-grow max-w-2xl flex flex-col h-100 mx-auto">
                <div className="flex-grow h-100 flex flex-row items-center justify-center" >
                    <div className="rounded-xl px-10 py-10 mx-auto">
                        <div className="mx-auto pb-8">
                            <img src={gitpodIcon} alt="Gitpod's logo" className="h-16 mx-auto" />
                        </div>
                        <div className="mx-auto text-center pb-8 space-y-2">
                            <h1 className="text-3xl">Authorize {clientName}</h1>
                        <h4>You are about to authorize {clientName} to access your Gitpod account including data for all workspaces.</h4>
                        </div>
                        <div className="flex justify-center mt-6">
                            <button className="secondary" onClick={() => updateClientApproval(false)}>Cancel</button>
                            <button key={"button-yes"} className="ml-2" onClick={() => updateClientApproval(true)}>
                                Authorize
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>);
}