import { User } from "@gitpod/gitpod-protocol";
import { useContext, useState } from "react";
import Modal from "../components/Modal";
import { SettingsPage } from "../components/SettingsPage";
import { UserContext } from "../user-context";
import accountMenu from "./account-menu";

export default function Profile() {
    const { user } = useContext(UserContext);

    const [modal, setModal] = useState(false);

    const close = () => setModal(false);
    return <div>
        <Modal visible={modal}>
            <h3>Do you really want to delete your account?</h3>
            <p>This action will remove all the data associated with your account in Gitpod and cannot be reversed.</p>
            <div className="flex justify-end pt-6">
                <button className="border-red-900 bg-red-500 hover:bg-red-700" onClick={close}>Delete Account</button>
            </div>
        </Modal>

        <SettingsPage title='Account' subtitle='Profile details' menuEntries={accountMenu}>
            <h3>Personal Information</h3>
            <div className="flex flex-col lg:flex-row">
                <div className="pb-6">
                    <div className="pt-6">
                        <h4>Name</h4>
                        <input type="text" value={user!.name} onChange={(v) => { console.log(v) }} />
                    </div>
                    <div className="pt-6">
                        <h4>Email</h4>
                        <input type="text" value={User.getPrimaryEmail(user!)} onChange={(v) => { console.log(v) }} />
                    </div>
                </div>
                <div className="lg:pl-14">
                    <div className="pt-6">
                        <h4>Avatar</h4>
                        <img className="rounded-full w-24 h-24 border-2 border-transparent hover:border-indigo-400"
                            src={user!.avatarUrl} alt={user!.name} />
                    </div>
                </div>
            </div>
            <h3 className="pt-14">Delete Account</h3>
            <p className="text-sm text-gray-400 pb-4">This action will remove all the data associated with your account in Gitpod.</p>
            <button className="border-red-900 bg-red-500 hover:bg-red-700" onClick={() => setModal(true)}>Delete Account</button>
        </SettingsPage>
    </div>;
}
