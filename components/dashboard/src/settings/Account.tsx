/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { useContext, useState } from "react";
import Modal from "../components/Modal";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { UserContext } from "../user-context";
import settingsMenu from "./settings-menu";

export default function Account() {
    const { user } = useContext(UserContext);

    const [modal, setModal] = useState(false);
    const [typedEmail, setTypedEmail] = useState('');

    const primaryEmail = User.getPrimaryEmail(user!);

    const deleteAccount = async () => {
        await getGitpodService().server.deleteAccount();
        document.location.href = gitpodHostUrl.asApiLogout().toString();
    };

    const close = () => setModal(false);
    return <div>
        <Modal visible={modal} onClose={close}>
            <h3 className="pb-2">Delete Account</h3>
            <div className="border-t border-b border-gray-200 mt-2 -mx-6 px-6 py-4">
                <p className="pb-4 text-gray-900 text-base">You are about to permanently delete your account.</p>
                <ol className="text-gray-500 text-sm list-outside list-decimal">
                    <li className="ml-5">All your workspaces and related data will be deleted and cannot be restored afterwards.</li>
                    <li className="ml-5">Your subscription will be cancelled. If you obtained a Gitpod subscription through the GitHub marketplace, you need to cancel your plan there.</li>
                </ol>
                <p className="pt-4 pb-2 text-gray-600 text-base font-semibold">Type your email to confirm</p>
                <input className="w-full" type="text" onChange={e => setTypedEmail(e.target.value)}></input>
            </div>
            <div className="flex justify-end mt-6">
                <button className="secondary" onClick={close}>Cancel</button>
                <button className="ml-2 danger" onClick={deleteAccount} disabled={typedEmail !== primaryEmail}>Delete Account</button>
            </div>
        </Modal>

        <PageWithSubMenu subMenu={settingsMenu}  title='Account' subtitle='Manage account and git configuration.'>
            <h3>Profile</h3>
            <p className="text-base text-gray-500 pb-4 max-w-2xl">The following information will be used to set up git configuration. You can override git author name and email per project by using the default environment variables <span className="text-gray--300 bg-gray-100 px-1.5 py-1 rounded-md text-sm font-mono font-medium">GIT_AUTHOR_NAME</span> and <span className="text-gray--300 bg-gray-100 px-1.5 py-1 rounded-md text-sm font-mono font-medium">GIT_COMMITTER_EMAIL</span>.</p>
            <div className="flex flex-col lg:flex-row">
                <div>
                    <div className="mt-4">
                        <h4>Name</h4>
                        <input type="text" disabled={true} value={user?.fullName || user?.name} />
                    </div>
                    <div className="mt-4">
                        <h4>Email</h4>
                        <input type="text" disabled={true} value={User.getPrimaryEmail(user!)} />
                    </div>
                </div>
                <div className="lg:pl-14">
                    <div className="mt-4">
                        <h4>Avatar</h4>
                        <img className="rounded-full w-24 h-24"
                            src={user!.avatarUrl} alt={user!.name} />
                    </div>
                </div>
            </div>
            <h3 className="mt-12">Delete Account</h3>
            <p className="text-base text-gray-500 pb-4">This action will remove all the data associated with your account in Gitpod.</p>
            <button className="danger secondary" onClick={() => setModal(true)}>Delete Account</button>
        </PageWithSubMenu>
    </div>;
}
