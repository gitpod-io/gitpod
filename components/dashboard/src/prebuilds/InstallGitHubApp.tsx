/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useLocation } from "react-router";
import Modal from "../components/Modal";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { useState } from "react";
import info from "../images/info.svg";

async function registerApp(installationId: string, setModal: (modal: 'done' | string | undefined) => void) {
    try {
        await getGitpodService().server.registerGithubApp(installationId);
        
        const returnTo = encodeURIComponent(gitpodHostUrl.with({ pathname: `login-success` }).toString());
        const url = gitpodHostUrl.withApi({
            pathname: '/authorize',
            search: `returnTo=${returnTo}&host=github.com&scopes=repo`
        }).toString();
        window.open(url, "gitpod-login");

        const result = new Deferred<void>(1000 * 60 * 10 /* 10 min */);
        result.promise.catch(e => setModal('error'));
        const listener = (event: MessageEvent<any>) => {
            // todo: check event.origin
            if (event.data === "auth-success") {
                if (event.source && "close" in event.source && event.source.close) {
                    console.log(`try to close window`);
                    event.source.close();
                } else {
                    // todo: not here, but add a button to the /login-success page to close, if this should not work as expected
                }
                window.removeEventListener("message", listener);
                setModal('done');
                result.resolve();
            }
        };
        window.addEventListener("message", listener);
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
            <div className="px-6 py-3 flex justify-between space-x-2 text-gray-400 border-t border-gray-200 h-96">
                <div className="flex flex-col items-center w-96 m-auto">
                    <h3 className="text-center pb-3 text-gray-500">No Installation ID Found</h3>
                    <div className="text-center pb-6 text-gray-500">Did you came here from the GitHub app's page?</div>
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
                    <div className="flex rounded-md bg-gray-200 p-3">
                        <img className="w-4 h-4 ml-2 mr-3 mt-1" src={info} alt="info" />
                        <span className="text-gray-500">This action will also allow Gitpod to access private repositories. You can edit git provider permissions later in user settings.</span>
                    </div>
                    <div className="mt-6">
                        <button className="secondary">Cancel</button>
                        <button className="ml-2" onClick={() => registerApp(installationId, setModal)}>Install App</button>
                    </div>
                </div>
            </div>
        </div>
        <Modal title="Installation Successfull" visible={modal === 'done'} onClose={goToApp} buttons={<button onClick={goToApp}>Go to Dashboard</button>}>
            <div className="pb-6 text-gray-500">The GitHub app was installed successfully. Have a look at the <a className="text-blue-500" href="https://www.gitpod.io/docs/prebuilds/" rel="noopener">documentation</a> to find out how to configure it.</div>
        </Modal>
        <Modal title="Failed to Install" visible={!!modal && modal !== 'done'} onClose={goToApp} buttons={[
            <button className="secondary" onClick={goToApp}>Cancel</button>,
            <button className="" onClick={() => registerApp(installationId, setModal)}>Try Again</button>
        ]}>
            <div className="pb-6 text-gray-500">Could not install the GitHub app.</div>
            <div className="flex rounded-md bg-gray-200 p-3">
                <img className="w-4 h-4 ml-2 mr-3 mt-1" src={info} alt="info" />
                <span className="text-gray-500">{modal}</span>
            </div>
        </Modal></>;
}