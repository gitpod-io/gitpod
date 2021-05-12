/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { UserContext } from "./user-context";
import { getGitpodService } from "./service/service";
import gitpodIcon from './icons/gitpod.svg';
import { useLocation } from "react-router";
import { getSafeURLRedirect } from "./provider-utils";

export default function OAuth2ClientApproval() {
    const { user, setUser } = useContext(UserContext);
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const clientID = params.get("clientID") || "";
    const clientName = params.get("clientName") || "";
    const redirectTo = getSafeURLRedirect(params.get("redirectTo") || undefined) || "/";

    const updateClientApproval = async (isApproved: boolean) => {
        if (!user) {
            return;
        }
        const additionalData = user.additionalData = user.additionalData || {};
        if (isApproved) {
            additionalData.oauth2ClientsApproved = {
                ...additionalData.oauth2ClientsApproved,
                [clientID]: new Date().toISOString()
            }
        } else if (additionalData.oauth2ClientsApproved) {
            delete additionalData.oauth2ClientsApproved[clientID];
        }
        await getGitpodService().server.updateLoggedInUser({
            additionalData
        });
        setUser(user);
        window.location.replace(`${redirectTo}&approved=${isApproved ? 'yes' : 'no'}`);
    }

    return (<div id="oauth2-container" className="z-50 flex w-screen h-screen">
        <div id="oauth2-section" className="flex-grow flex w-full">
            <div id="oauth2-section-column" className="flex-grow max-w-2xl flex flex-col h-100 mx-auto">
                <div className="flex-grow h-100 flex flex-row items-center justify-center" >
                    <div className="rounded-xl px-10 py-10 mx-auto">
                        <div className="mx-auto pb-8">
                            <img src={gitpodIcon} className="h-16 mx-auto" />
                        </div>
                        <div className="mx-auto text-center pb-8 space-y-2">
                            <h1 className="text-3xl">The client: "{clientName}"" is requesting access</h1>
                            <h4>Select 'Yes' to allow this client access to your workspace. 'No' to reject it.</h4>
                        </div>
                        <div className="flex flex-col space-y-3 items-center">
                            <button key={"button-yes"} className="primary" onClick={() => updateClientApproval(true)}>
                                Yes
                            </button>
                            <button className="secondary" onClick={() => updateClientApproval(false)}>No</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>);
}