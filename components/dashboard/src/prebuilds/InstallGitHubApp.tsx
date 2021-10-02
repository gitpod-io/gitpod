/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useLocation } from "react-router";
import InfoBox from "../components/InfoBox";
import Modal from "../components/Modal";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { useState } from "react";
import { openAuthorizeWindow } from "../provider-utils";

async function registerApp(installationId: string, setModal: (modal: 'done' | string | undefined) => void) {
    try {
        await getGitpodService().server.registerGithubApp(installationId);

        const result = new Deferred<void>(1000 * 60 * 10 /* 10 min */);

        openAuthorizeWindow({
            host: "github.com",
            scopes: ["repo"],
            onSuccess: () => {
                setModal('done');
                result.resolve();
            },
            onError: (payload) => {
                let errorMessage: string;
                if (typeof payload === "string") {
                    errorMessage = payload;
                } else {
                    errorMessage = payload.description ? payload.description : `Error: ${payload.error}`;
                }
                setModal(errorMessage);
            }
        })

        return result.promise;
    } catch (e) {
        setModal(e.message);
    }
}

export default function InstallGitHubApp() {
    const location = useLocation();
    const [modal, setModal] = useState<'done' | string | undefined>();
    const params = new URLSearchParams(location.search);
    const installationId = params.get("installation_id") || undefined;
    if (!installationId) {
        return <div className="lg:px-28 px-10 flex flex-col space-y-2">
            <div className="px-6 py-3 flex justify-between space-x-2 text-gray-400 border-t border-gray-200 dark:border-gray-800 h-96">
                <div className="flex flex-col items-center w-96 m-auto">
                    <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">No Installation ID Found</h3>
                    <div className="text-center pb-6 text-gray-500">Did you come here from the GitHub app's page?</div>
                </div>
            </div>
        </div>
    }

    const goToApp = () => window.location.href = gitpodHostUrl.toString();

    return <>
        <div className="lg:px-28 px-10 flex flex-col space-y-2">
            <div className="px-6 py-3 flex justify-between space-x-2 text-gray-400">
                <div className="flex flex-col items-center m-auto max-w-lg mt-40">
                    <h3 className="text-center pb-3 text-gray-500">Install GitHub App</h3>
                    <div className="text-center pb-6 text-gray-500">You are about to install the GitHub app for Gitpod.</div>
                    <InfoBox>This action will also allow Gitpod to access private repositories. You can edit Git provider permissions later in user settings.</InfoBox>
                    <div className="mt-6">
                        <button className="secondary">Cancel</button>
                        <button className="ml-2" onClick={() => registerApp(installationId, setModal)}>Install App</button>
                    </div>
                </div>
            </div>
        </div>
        <Modal title="Installation Successful" visible={modal === 'done'} onClose={goToApp} buttons={<button onClick={goToApp}>Go to Dashboard</button>}>
            <div className="pb-6 text-gray-500">The GitHub app was installed successfully. Have a look at the <a className="text-blue-500" href="https://www.gitpod.io/docs/prebuilds/" rel="noopener">documentation</a> to find out how to configure it.</div>
        </Modal>
        <Modal title="Failed to Install" visible={!!modal && modal !== 'done'} onClose={goToApp} buttons={[
            <button className="secondary" onClick={goToApp}>Cancel</button>,
            <button className="" onClick={() => registerApp(installationId, setModal)}>Try Again</button>
        ]}>
            <div className="pb-6 text-gray-500">Could not install the GitHub app.</div>
            <InfoBox>{modal}</InfoBox>
        </Modal></>;
}