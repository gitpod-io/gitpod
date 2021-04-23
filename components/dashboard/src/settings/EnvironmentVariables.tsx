/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { UserEnvVarValue } from "@gitpod/gitpod-protocol";
import { useEffect, useRef, useState } from "react";
import ContextMenu from "../components/ContextMenu";
import Modal from "../components/Modal";
import { getGitpodService } from "../service/service";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import settingsMenu from "./settings-menu";

interface EnvVarModalProps {
    envVar: UserEnvVarValue;
    onClose: () => void;
    save: (v: UserEnvVarValue) => void;
    validate: (v: UserEnvVarValue) => string;
}

function AddEnvVarModal(p: EnvVarModalProps) {
    const [ev, setEv] = useState({...p.envVar});
    const [error, setError] = useState('');
    const ref = useRef(ev);

    const update = (pev: Partial<UserEnvVarValue>) => {
        const newEnv = { ...ref.current, ... pev};
        setEv(newEnv);
        ref.current = newEnv;
    };

    useEffect(() => {
        setEv({...p.envVar});
        setError('');
    }, [p.envVar]);

    const isNew = !p.envVar.id;
    let save = () => {
        const v = ref.current;
        const errorMsg = p.validate(v);
        if (errorMsg !== '') {
            setError(errorMsg);
            return false;
        } else {
            p.save(v);
            p.onClose();
            return true;
        }
    };

    return <Modal visible={true} onClose={p.onClose} onEnter={save}>
        <h3 className="mb-4">{isNew ? 'New' : 'Edit'} Variable</h3>
        <div className="border-t border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4 flex flex-col">
            {error ? <div className="bg-gitpod-kumquat-light rounded-md p-3 text-gitpod-red text-sm mb-2">
                {error}
            </div> : null}
            <div>
                <h4>Name</h4>
                <input className="w-full" type="text" value={ev.name} onChange={(v) => { update({name: v.target.value}) }} />
            </div>
            <div className="mt-4">
                <h4>Value</h4>
                <input className="w-full" type="text" value={ev.value} onChange={(v) => { update({value: v.target.value}) }} />
            </div>
            <div className="mt-4">
                <h4>Scope</h4>
                <input className="w-full" type="text" value={ev.repositoryPattern} placeholder="e.g. org/project"
                    onChange={(v) => { update({repositoryPattern: v.target.value}) }} />
            </div>
            <div className="mt-1">
                <p className="text-gray-500">You can pass a variable for a specific project or use wildcard character (<span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-1 rounded-md text-sm font-mono font-medium">*/*</span>) to make it available in more projects.</p>
            </div>
        </div>
        <div className="flex justify-end mt-6">
            <button className="secondary" onClick={p.onClose}>Cancel</button>
            <button className="ml-2" onClick={save} >{isNew ? 'Add' : 'Update'} Variable</button>
        </div>
    </Modal>
}

function DeleteEnvVarModal(p: { variable: UserEnvVarValue, deleteVariable: () => void, onClose: () => void }) {
    return <Modal visible={true} onClose={p.onClose}>
        <h3 className="mb-4">Delete Variable?</h3>
        <div className="border-t border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4 flex flex-col">
            <div className="grid grid-cols-2 gap-4 px-3 text-sm text-gray-400">
                <span className="truncate">Name</span>
                <span className="truncate">Scope</span>
            </div>
            <div className="grid grid-cols-2 gap-4 p-3 mt-3 text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <span className="truncate text-gray-900 dark:text-gray-50">{p.variable.name}</span>
                <span className="truncate text-sm">{p.variable.repositoryPattern}</span>
            </div>
        </div>
        <div className="flex justify-end mt-6">
            <button className="secondary" onClick={p.onClose}>Cancel</button>
            <button className="ml-2 danger" onClick={() => { p.deleteVariable(); p.onClose(); }} >Delete Variable</button>
        </div>
    </Modal>;
}

function sortEnvVars(a: UserEnvVarValue, b: UserEnvVarValue) {
    if (a.name === b.name) {
        return a.repositoryPattern > b.repositoryPattern ? 1 : -1;
    }
    return a.name > b.name ? 1 : -1;
}

export default function EnvVars() {
    const [envVars, setEnvVars] = useState([] as UserEnvVarValue[]);
    const [currentEnvVar, setCurrentEnvVar] = useState({ name: '', value: '', repositoryPattern: '' } as UserEnvVarValue);
    const [isAddEnvVarModalVisible, setAddEnvVarModalVisible] = useState(false);
    const [isDeleteEnvVarModalVisible, setDeleteEnvVarModalVisible] = useState(false);
    const update = async () => {
        await getGitpodService().server.getAllEnvVars().then(r => setEnvVars(r.sort(sortEnvVars)));
    }

    useEffect(() => {
        update()
    }, []);


    const add = () => {
        setCurrentEnvVar({ name: '', value: '', repositoryPattern: '' });
        setAddEnvVarModalVisible(true);
        setDeleteEnvVarModalVisible(false);
    }

    const edit = (variable: UserEnvVarValue) => {
        setCurrentEnvVar(variable);
        setAddEnvVarModalVisible(true);
        setDeleteEnvVarModalVisible(false);
    }

    const confirmDeleteVariable = (variable: UserEnvVarValue) => {
        setCurrentEnvVar(variable);
        setAddEnvVarModalVisible(false);
        setDeleteEnvVarModalVisible(true);
    }

    const save = async (variable: UserEnvVarValue) => {
        await getGitpodService().server.setEnvVar(variable);
        await update();
    };

    const deleteVariable = async (variable: UserEnvVarValue) => {
        await getGitpodService().server.deleteEnvVar(variable);
        await update();
    };

    const validate = (variable: UserEnvVarValue) => {
        const name = variable.name;
        const pattern = variable.repositoryPattern;
        if (name.trim() === '') {
            return 'Name must not be empty.';
        }
        if (!/^[a-zA-Z0-9_]*$/.test(name)) {
            return 'Name must match /[a-zA-Z_]+[a-zA-Z0-9_]*/.';
        }
        if (variable.value.trim() === '') {
            return 'Value must not be empty.';
        }
        if (pattern.trim() === '') {
            return 'Scope must not be empty.';
        }
        const split = pattern.split('/');
        if (split.length < 2) {
            return "A scope must use the form 'organization/repo'.";
        }
        for (const name of split) {
            if (name !== '*') {
                if (!/^[a-zA-Z0-9_\-.\*]+$/.test(name)) {
                    return 'Invalid scope segment. Only ASCII characters, numbers, -, _, . or * are allowed.';
                }
            }
        }
        if (!variable.id && envVars.some(v => v.name === name && v.repositoryPattern === pattern)) {
            return 'A variable with this name and scope already exists';
        }
        return '';
    };

    return <PageWithSubMenu subMenu={settingsMenu} title='Variables' subtitle='Configure environment variables for all workspaces.'>
        {isAddEnvVarModalVisible && <AddEnvVarModal
            save={save}
            envVar={currentEnvVar}
            validate={validate}
            onClose={() => setAddEnvVarModalVisible(false)} />}
        {isDeleteEnvVarModalVisible && <DeleteEnvVarModal
            variable={currentEnvVar}
            deleteVariable={() => deleteVariable(currentEnvVar)}
            onClose={() => setDeleteEnvVarModalVisible(false)} />}
        <div className="flex items-start sm:justify-between mb-2">
            <div>
                <h3>Environment Variables</h3>
                <h2 className="text-gray-500">Variables are used to store information like passwords.</h2>
            </div>
            {envVars.length !== 0
                ? <div className="mt-3 flex mt-0">
                    <button onClick={add} className="ml-2">New Variable</button>
                </div>
                : null}
        </div>
        {envVars.length === 0
            ? <div className="bg-gray-100 dark:bg-gray-800 rounded-xl w-full h-96">
                <div className="pt-28 flex flex-col items-center w-96 m-auto">
                    <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">No Environment Variables</h3>
                    <div className="text-center pb-6 text-gray-500">In addition to user-specific environment variables you can also pass variables through a workspace creation URL. <a className="text-gray-400 underline underline-thickness-thin underline-offset-small hover:text-gray-600" href="https://www.gitpod.io/docs/environment-variables/#using-the-account-settings">Learn more</a></div>
                    <button onClick={add}>New Variable</button>
                </div>
            </div>
            : <div className="space-y-2">
                <div className="flex flex-col space-y-2">
                    <div className="px-3 py-3 flex justify-between space-x-2 text-sm text-gray-400 border-t border-b border-gray-200 dark:border-gray-800">
                        <div className="w-5/12">Name</div>
                        <div className="w-5/12">Scope</div>
                        <div className="w-2/12"></div>
                    </div>
                </div>
                <div className="flex flex-col">
                    {envVars.map(variable => {
                        return <div className="rounded-xl whitespace-nowrap flex space-x-2 py-3 px-3 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light transition ease-in-out group">
                            <div className="w-5/12 m-auto">{variable.name}</div>
                            <div className="w-5/12 m-auto text-sm text-gray-400">{variable.repositoryPattern}</div>
                            <div className="w-2/12 flex justify-end">
                                <div className="flex w-8 self-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md cursor-pointer opacity-0 group-hover:opacity-100">
                                    <ContextMenu menuEntries={[
                                        {
                                            title: 'Edit',
                                            onClick: () => edit(variable),
                                            separator: true
                                        },
                                        {
                                            title: 'Delete',
                                            customFontStyle: 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300',
                                            onClick: () => confirmDeleteVariable(variable)
                                        },
                                    ]}>
                                        <svg className="w-8 h-8 p-1 text-gray-600 dark:text-gray-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>Actions</title><g fill="currentColor" transform="rotate(90 12 12)"><circle cx="1" cy="1" r="2" transform="translate(5 11)"/><circle cx="1" cy="1" r="2" transform="translate(11 11)"/><circle cx="1" cy="1" r="2" transform="translate(17 11)"/></g></svg>
                                    </ContextMenu>
                                </div>
                            </div>
                        </div>
                    })}
                </div>
            </div>
        }
    </PageWithSubMenu>;
}