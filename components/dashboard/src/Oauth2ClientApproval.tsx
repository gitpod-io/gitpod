/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { UserContext } from "./user-context";
import { getGitpodService } from "./service/service";
import gitpodIcon from './icons/gitpod.svg';
import { Link } from "react-router-dom";
import { useLocation } from "react-router";
import { getSafeURLRedirect } from "./provider-utils";

export default function OAuth2ClientApproval() {
    const { user, setUser } = useContext(UserContext);
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const client = params.get("client") || "";
    const redirectTo = getSafeURLRedirect(params.get("redirectTo") || undefined) || "/";

    const approveClient = async () => {
        if (!user) {
            return;
        }
        const additionalData = user.additionalData = user.additionalData || {};
        additionalData.oauth2ClientsApproved = {
            ...additionalData.oauth2ClientsApproved,
            [client]: new Date().toISOString()
        }
        await getGitpodService().server.updateLoggedInUser({
            additionalData
        });
        setUser(user);
        window.location.replace(redirectTo);
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
                            <h1 className="text-3xl">{client} Client Approval</h1>
                            <h4>Select 'Yes' to approve access to your workspace using this client. 'No' to reject it.</h4>
                        </div>
                        <div className="flex flex-col space-y-3 items-center">
                            <button key={"button-yes"} className="btn-oauth2 flex-none w-56 h-10 p-0 inline-flex" onClick={() => approveClient()}>
                                <span className="pt-2 pb-2 mr-3 text-sm my-auto font-medium truncate overflow-ellipsis">Yes. I approve</span>
                            </button>
                            <Link to="/"><button className="secondary">No. Do not allow access my workspace</button></Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>);
}