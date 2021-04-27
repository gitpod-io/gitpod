/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { CommitContext, Workspace, WorkspaceInfo, WorkspaceInstance, WorkspaceInstancePhase } from '@gitpod/gitpod-protocol';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import ContextMenu, { ContextMenuEntry } from '../components/ContextMenu';
import moment from 'moment';
import Modal from '../components/Modal';
import { useState } from 'react';
import { WorkspaceModel } from './workspace-model';
import PendingChangesDropdown from '../components/PendingChangesDropdown';
import Tooltip from '../components/Tooltip';

function getLabel(state: WorkspaceInstancePhase) {
    return state.substr(0,1).toLocaleUpperCase() + state.substr(1);
}

interface Props {
    desc: WorkspaceInfo;
    model: WorkspaceModel;
    isAdmin?: boolean;
    stopWorkspace: (ws: string) => Promise<void>;
}

export function WorkspaceEntry({ desc, model, isAdmin, stopWorkspace }: Props) {
    const [isModalVisible, setModalVisible] = useState(false);
    const state: WorkspaceInstancePhase = desc.latestInstance?.status?.phase || 'stopped';
    const currentBranch = desc.latestInstance?.status.repo?.branch || Workspace.getBranchName(desc.workspace) || '<unknown>';
    const ws = desc.workspace;
    const startUrl = new GitpodHostUrl(window.location.href).with({
        pathname: '/start/',
        hash: '#' + ws.id
    });
    const downloadURL = new GitpodHostUrl(window.location.href).with({
        pathname: `/workspace-download/get/${ws.id}`
    }).toString();
    const menuEntries: ContextMenuEntry[] = [
        {
            title: 'Open',
            href: startUrl.toString()
        }];
    if (state === 'running') {
        menuEntries.push({
            title: 'Stop',
            onClick: () => stopWorkspace(ws.id)
        });
    }
    menuEntries.push(
        {
            title: 'Download',
            href: downloadURL
        });
    if (!isAdmin) {
        menuEntries.push(
            {
                title: 'Share',
                active: !!ws.shareable,
                onClick: () => {
                    model.toggleShared(ws.id);
                }
            },
            {
                title: 'Pin',
                active: !!ws.pinned,
                separator: true,
                onClick: () => {
                    model.togglePinned(ws.id);
                }
            },
            {
                title: 'Delete',
                customFontStyle: 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300',
                onClick: () => {
                    setModalVisible(true);
                }
            }
        );
    }
    const project = getProject(ws);
    return <div>
        <div className="rounded-xl whitespace-nowrap flex space-x-2 py-6 px-6 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light group">
            <div className="pr-3 self-center">
                <WorkspaceStatusIndicator instance={desc?.latestInstance} />
            </div>
            <div className="flex flex-col w-3/12">
                <a href={startUrl.toString()}><div className="font-medium text-gray-800 dark:text-gray-100 truncate hover:text-blue-600 dark:hover:text-blue-400">{ws.id}</div></a>
                <a href={project ? 'https://' + project : undefined}><div className="text-sm overflow-ellipsis truncate text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">{project || 'Unknown'}</div></a>
            </div>
            <div className="flex w-4/12 truncate overflow-ellipsis">
                <div className="flex flex-col">
                    <div className="text-gray-500 overflow-ellipsis truncate">{ws.description}</div>
                    <a href={ws.contextURL}>
                        <div className="text-sm text-gray-400 overflow-ellipsis truncate hover:text-blue-600 dark:hover:text-blue-400">{ws.contextURL}</div>
                    </a>
                </div>
            </div>
            <div className="flex flex-col items-start w-2/12">
                <div className="text-gray-500 truncate">{currentBranch}</div>
                <PendingChangesDropdown workspaceInstance={desc.latestInstance} />
            </div>
            <div className="flex w-2/12 self-center">
                <Tooltip content={`Created ${moment(desc.workspace.creationTime).fromNow()}`}>
                    <div className="text-sm w-full text-gray-400 truncate">{moment(WorkspaceInfo.lastActiveISODate(desc)).fromNow()}</div>
                </Tooltip>
            </div>
            <div className="flex w-8 self-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md cursor-pointer opacity-0 group-hover:opacity-100">
                <ContextMenu menuEntries={menuEntries}>
                    <svg className="w-8 h-8 p-1 text-gray-600 dark:text-gray-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>Actions</title><g fill="currentColor" transform="rotate(90 12 12)"><circle cx="1" cy="1" r="2" transform="translate(5 11)"/><circle cx="1" cy="1" r="2" transform="translate(11 11)"/><circle cx="1" cy="1" r="2" transform="translate(17 11)"/></g></svg>
                </ContextMenu>
            </div>
        </div>
        {isModalVisible && <Modal visible={isModalVisible} onClose={() => setModalVisible(false)}>
            <div>
                <h3 className="pb-2">Delete Workspace</h3>
                <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-2 -mx-6 px-6 py-2">
                    <p className="mt-1 mb-2 text-base">Are you sure you want to delete this workspace?</p>
                    <div className="w-full p-4 mb-2 bg-gray-100 rounded-xl group bg-gray-100">
                        <p className="text-base text-gray-800 dark:text-gray-100 font-semibold">{ws.id}</p>
                        <p>{ws.description}</p>
                    </div>
                </div>
                <div className="flex justify-end mt-5">
                    <button className="danger"
                        onClick={() => model.deleteWorkspace(ws.id)}>
                        Delete Workspace
                    </button>
                </div>
            </div>
        </Modal>}
    </div>;
}

export function getProject(ws: Workspace) {
    if (CommitContext.is(ws.context)) {
        return `${ws.context.repository.host}/${ws.context.repository.owner}/${ws.context.repository.name}`;
    } else {
        return undefined;
    }
}

export function WorkspaceStatusIndicator({instance}: {instance?: WorkspaceInstance}) {
    const state: WorkspaceInstancePhase = instance?.status?.phase || 'stopped';
    let stateClassName = 'rounded-full w-3 h-3 text-sm align-middle';
    switch (state) {
        case 'running': {
            stateClassName += ' bg-green-500'
            break;
        }
        case 'stopped': {
            stateClassName += ' bg-gray-400'
            break;
        }
        case 'interrupted': {
            stateClassName += ' bg-red-400'
            break;
        }
        default: {
            stateClassName += ' bg-gitpod-kumquat animate-pulse'
            break;
        }
    }
    return <Tooltip content={getLabel(state)}>
        <div className={stateClassName}>
        </div>
    </Tooltip>;
}