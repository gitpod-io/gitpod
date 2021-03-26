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
import { SettingsPage } from "./SettingsPage";
import ThreeDots from '../icons/ThreeDots.svg';

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
        <h3 className="pb-2">{isNew ? 'New' : 'Edit'} Variable</h3>
        <div className="border-t -mx-6 px-6 py-2 flex flex-col">
            {error ? <div className="bg-gitpod-kumquat-light rounded-md p-3 text-red-500 text-sm">
                {error}
            </div> : null}
            <div className="mt-4">
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
            <div className="mt-3">
                <p>You can pass a variable for a specific project or use wildcard characters (<span className="text-gitpod-kumquat-dark bg-gitpod-kumquat-light px-1 py-0.5 rounded-md text-sm font-mono">*/*</span>) to make it available in more projects.</p>
            </div>
        </div>
        <div className="flex justify-end mt-6">
            <button className="text-gray-900 border-white bg-white hover:bg-gray-100 hover:border-gray-100" onClick={p.onClose}>Cancel</button>
            <button className={"ml-2 disabled:opacity-50"} onClick={save} >{isNew ? 'Add' : 'Update'} Variable</button>
        </div>
    </Modal>
}

export default function EnvVars() {
    const [envVars, setEnvVars] = useState([] as UserEnvVarValue[]);
    const [currentEnvVar, setCurrentEnvVar] = useState({ name: '', value: '', repositoryPattern: '' } as UserEnvVarValue);
    const [isAddEnvVarModalVisible, setAddEnvVarModalVisible] = useState(false);
    const update = async () => {
        await getGitpodService().server.getEnvVars().then(r => setEnvVars(r));
    }

    useEffect(() => {
        update()
    }, []);


    const add = () => {
        setCurrentEnvVar({ name: '', value: '', repositoryPattern: '' });
        setAddEnvVarModalVisible(true);
    }

    const edit = (ev: UserEnvVarValue) => {
        setCurrentEnvVar(ev);
        setAddEnvVarModalVisible(true);
    }

    const save = async (variable: UserEnvVarValue) => {
        await getGitpodService().server.setEnvVar(variable);
        await update();
    };

    const deleteV = async (variable: UserEnvVarValue) => {
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
        return '';
    };

    return <SettingsPage title='Variables' subtitle='Configure environment variables for all workspaces.'>
        {isAddEnvVarModalVisible ? <AddEnvVarModal
            save={save}
            envVar={currentEnvVar}
            validate={validate}
            onClose={() => setAddEnvVarModalVisible(false)} /> : null}
        {envVars.length === 0
            ? <div className="bg-gray-100 rounded-xl w-full h-96">
                <div className="pt-28 flex flex-col items-center w-96 m-auto">
                    <h3 className="text-center pb-3 text-gray-500">No Environment Variables</h3>
                    <div className="text-center pb-6 text-gray-500">In addition to user-specific environment variables you can also pass variables through a workspace creation URL. <a className="text-gray-400 underline underline-thickness-thin underline-offset-small hover:text-gray-600" href="https://www.gitpod.io/docs/environment-variables/#using-the-account-settings">Learn more</a></div>
                    <button onClick={add} className="font-medium">New Environment Variable</button>
                </div>
            </div>
            : <div className="space-y-2">
                <div className="flex justify-end mb-2">
                    <button onClick={add} className="ml-2 font-medium">New Environment Variable</button>
                </div>
                <div className="flex flex-col space-y-2">
                    <div className="px-3 py-3 flex justify-between space-x-2 text-sm text-gray-400 border-t border-b border-gray-200">
                        <div className="w-5/12">Name</div>
                        <div className="w-5/12">Scope</div>
                        <div className="w-2/12"></div>
                    </div>
                </div>
                <div className="flex flex-col">
                    {envVars.map(ev => {
                        return <div className="rounded-xl whitespace-nowrap flex space-x-2 py-3 px-3 w-full justify-between hover:bg-gray-100 focus:bg-gitpod-kumquat-light group">
                            <div className="w-5/12 m-auto">{ev.name}</div>
                            <div className="w-5/12 m-auto text-sm text-gray-400">{ev.repositoryPattern}</div>
                            <div className="w-2/12 flex justify-end">
                                <div className="flex w-8 self-center hover:bg-gray-200 rounded-md cursor-pointer">
                                    <ContextMenu menuEntries={[
                                        {
                                            title: 'Edit',
                                            onClick: () => edit(ev),
                                            separator: true
                                        },
                                        {
                                            title: 'Delete',
                                            customFontStyle: 'text-red-600 hover:text-red-800',
                                            onClick: () => deleteV(ev)
                                        },
                                    ]}>
                                        <img className="w-8 h-8 p-1" src={ThreeDots} alt="Actions" />
                                    </ContextMenu>
                                </div>
                            </div>
                        </div>
                    })}
                </div>
            </div>
        }
    </SettingsPage>;
}