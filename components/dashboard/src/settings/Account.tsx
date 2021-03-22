/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { useContext, useState } from "react";
import Modal from "../components/Modal";
import { UserContext } from "../user-context";
import { SettingsPage } from "./SettingsPage";

export default function Account() {
    const { user } = useContext(UserContext);

    const [modal, setModal] = useState(false);

    const close = () => setModal(false);
    return <div>
        <Modal visible={modal} onClose={close}>
            <h3 className="pb-2">Delete Account</h3>
            <div className="border-t border-b border-gray-200 mt-2 -mx-6 px-6 py-2">
              <p className="mt-1 mb-2 text-base">Are you sure you want to delete your account? This action will remove all the data associated with your account in Gitpod and cannot be reversed.</p>
            </div>
            <div className="flex justify-end mt-6">
                <button className="border-red-900 bg-red-500 hover:bg-red-700" onClick={close}>Delete Account</button>
            </div>
        </Modal>

        <SettingsPage title='Account' subtitle='Manage account and git configuration.'>
            <h3>Profile</h3>
            <p className="text-base text-gray-500 pb-4">The following information will be used to set up git configuration. You can override git author name and email per project by using the default environment variables <span className="text-gitpod-kumquat-dark bg-gitpod-kumquat-light px-1.5 py-1 rounded-md text-sm font-mono">GIT_AUTHOR_NAME</span> and <span className="text-gitpod-kumquat-dark bg-gitpod-kumquat-light px-1.5 py-1 rounded-md text-sm font-mono">GIT_COMMITTER_EMAIL</span>.</p>
            <div className="flex flex-col lg:flex-row">
                <div>
                    <div className="mt-4">
                        <h4>Name</h4>
                        <input type="text" disabled={true} value={user!.name} onChange={(v) => { console.log(v) }} />
                    </div>
                    <div className="mt-4">
                        <h4>Email</h4>
                        <input type="text" disabled={true} value={User.getPrimaryEmail(user!)} onChange={(v) => { console.log(v) }} />
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
            <button className="border-red-600 text-red-600 bg-white hover:border-red-800 hover:text-red-800 font-medium" onClick={() => setModal(true)}>Delete Account</button>
        </SettingsPage>
    </div>;
}
