/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { CommitContext, Workspace, WorkspaceInfo, WorkspaceInstance, WorkspaceInstancePhase } from '@gitpod/gitpod-protocol';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import ContextMenu, { ContextMenuEntry } from '../components/ContextMenu';
import ThreeDots from '../icons/ThreeDots.svg';
import moment from 'moment';
import { getGitpodService } from '../service/service';
import Modal from '../components/Modal';
import { MouseEvent, useState } from 'react';
import { WorkspaceModel } from './workspace-model';


export function WorkspaceEntry({ desc, model }: { desc: WorkspaceInfo, model: WorkspaceModel }) {
    const [isModalVisible, setModalVisible] = useState(false);
    const [isChangesModalVisible, setChangesModalVisible] = useState(false);
    const state: WorkspaceInstancePhase = desc.latestInstance?.status?.phase || 'stopped';
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
    const pendingChanges = getPendingChanges(desc.latestInstance);
    const numberOfChanges = pendingChanges.reduceRight((i, c) => i + c.items.length, 0)
    let changesLabel = 'No Changes';
    if (numberOfChanges === 1) {
        changesLabel = '1 Change';
    } else if (numberOfChanges > 1) {
        changesLabel = numberOfChanges + ' Changes';
    }
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
            onClick: () => getGitpodService().server.stopWorkspace(ws.id)
        });
    }
    menuEntries.push(
        {
            title: 'Download',
            href: downloadURL
        },
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
            customFontStyle: 'text-red-600',
            onClick: () => {
                setModalVisible(true);
            }
        }
    );
    const project = getProject(ws);
    const showChanges = (event: MouseEvent) => {
        event.preventDefault();
        setChangesModalVisible(true);
    }
    return <div>
        <a className="rounded-xl whitespace-nowrap flex space-x-2 py-6 px-6 w-full justify-between hover:bg-gray-100 focus:bg-gitpod-kumquat-light cursor-pointer group" href={startUrl.toString()}>
            <div className="pr-3 self-center">
                <div className={stateClassName}>
                    &nbsp;
            </div>
            </div>
            <div className="flex flex-col w-3/12">
                <div className="font-medium text-gray-800 truncate">{ws.id}</div>
                <a href={project ? 'https://' + project : undefined}><div className="text-sm overflow-ellipsis truncate text-gray-400">{project || 'Unknown'}</div></a>
            </div>
            <div className="flex w-4/12 truncate overflow-ellipsis">
                <div className="flex flex-col">
                    <div className="font-medium text-gray-500 overflow-ellipsis truncate">{ws.description}</div>
                    <div className="text-sm text-gray-400 overflow-ellipsis truncate">{ws.contextURL}</div>
                </div>
            </div>
            <div className="flex w-2/12 truncate" onClick={numberOfChanges > 0 ? showChanges : undefined}>
                <div className="flex flex-col">
                    <div className="font-medium text-gray-500 truncate">{currentBranch}</div>
                    {
                        numberOfChanges > 0 ?
                            <div className={"text-sm text-red-600 truncate cursor-pointer bg-red-50 group-hover:bg-red-100 hover:text-red-800 px-1.5 py-0.5 relative rounded-md -top-0.5"} onClick={showChanges}>{changesLabel}</div>
                            :
                            <div className="text-sm text-gray-500 truncate ">No Changes</div>
                    }
                </div>
            </div>
            <div className="flex w-2/12 self-center space-x-2 truncate">
                <div className="text-sm text-gray-400 truncate">{moment(WorkspaceInfo.lastActiveISODate(desc)).fromNow()}</div>
            </div>
            <div className="flex w-8 self-center hover:bg-gray-200 rounded-md cursor-pointer">
                <ContextMenu menuEntries={menuEntries}>
                    <img className="w-8 h-8 p-1" src={ThreeDots} alt="Actions" />
                </ContextMenu>
            </div>
        </a>
        <Modal visible={isChangesModalVisible} onClose={() => setChangesModalVisible(false)}>
            {getChangesPopup(pendingChanges)}
        </Modal>
        <Modal visible={isModalVisible} onClose={() => setModalVisible(false)} onEnter={() => {model.deleteWorkspace(ws.id); return true;}}>
            <div>
                <h3 className="pb-2">Delete Workspace</h3>
                <div className="border-t border-b border-gray-200 mt-2 -mx-6 px-6 py-2">
                    <p className="mt-1 mb-2 text-base">Are you sure you want to delete this workspace?</p>
                    <div className="w-full p-4 mb-2 bg-gray-100 rounded-xl group bg-gray-100">
                        <p className="text-base text-gray-800 font-semibold">{ws.id}</p>
                        <p>{ws.description}</p>
                    </div>
                </div>
                <div className="flex justify-end mt-5">
                    <button className="cursor-pointer px-3 py-2 text-white text-sm rounded-md border-2 border-red-800 bg-red-600 hover:bg-red-800"
                        onClick={() => model.deleteWorkspace(ws.id)}>
                        Delete Workspace
                    </button>
                </div>
            </div>
        </Modal>
    </div>;
}

interface PendingChanges {
    message: string, items: string[]
}

function getPendingChanges(wsi?: WorkspaceInstance): PendingChanges[] {
    const pendingChanges: { message: string, items: string[] }[] = [];
    const repo = wsi?.status.repo;
    if (repo) {
        if (repo.totalUncommitedFiles || 0 > 0) {
            pendingChanges.push({
                message: repo.totalUncommitedFiles === 1 ? 'an uncommited file' : `${repo.totalUncommitedFiles} uncommited files`,
                items: repo.uncommitedFiles || []
            });
        }
        if (repo.totalUntrackedFiles || 0 > 0) {
            pendingChanges.push({
                message: repo.totalUntrackedFiles === 1 ? 'an untracked file' : `${repo.totalUntrackedFiles} untracked files`,
                items: repo.untrackedFiles || []
            });
        }
        if (repo.totalUnpushedCommits || 0 > 0) {
            pendingChanges.push({
                message: repo.totalUnpushedCommits === 1 ? 'an unpushed commit' : `${repo.totalUnpushedCommits} unpushed commits`,
                items: repo.unpushedCommits || []
            });
        }
    }
    return pendingChanges;
}

function getProject(ws: Workspace) {
    if (CommitContext.is(ws.context)) {
        return `${ws.context.repository.host}/${ws.context.repository.owner}/${ws.context.repository.name}`;
    } else {
        return undefined;
    }
}

function getChangesPopup(changes: PendingChanges[]) {
    return <div className="flex flex-col space-y-4 w-96">
        {changes.map(c => {
            return <div className="">
                <div className="text-gray-500">{c.message}</div>
                {c.items.map(i => <div className="text-gray-400 text-xs">{i}</div>)}
            </div>;
        })}
    </div>
}