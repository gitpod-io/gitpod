/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { CommitContext, Workspace, WorkspaceInfo, WorkspaceInstance, WorkspaceInstanceConditions, WorkspaceInstancePhase } from '@gitpod/gitpod-protocol';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import moment from 'moment';
import React, { useState } from 'react';
import ConfirmationModal from '../components/ConfirmationModal';
import { ContextMenuEntry } from '../components/ContextMenu';
import { Item, ItemField, ItemFieldContextMenu, ItemFieldIcon } from '../components/ItemsList';
import PendingChangesDropdown from '../components/PendingChangesDropdown';
import Tooltip from '../components/Tooltip';
import { WorkspaceModel } from './workspace-model';

function getLabel(state: WorkspaceInstancePhase, conditions?: WorkspaceInstanceConditions) {
    if (conditions?.failed) {
        return "Failed";
    }
    return state.substr(0, 1).toLocaleUpperCase() + state.substr(1);
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

    return <Item className="whitespace-nowrap py-6 px-6">
        <ItemFieldIcon>
            <WorkspaceStatusIndicator instance={desc?.latestInstance} />
        </ItemFieldIcon>
        <ItemField className="w-3/12 flex flex-col">
            <a href={startUrl.toString()}><div className="font-medium text-gray-800 dark:text-gray-200 truncate hover:text-blue-600 dark:hover:text-blue-400">{ws.id}</div></a>
            <Tooltip content={project ? 'https://' + project : ''} allowWrap={true}>
                <a href={project ? 'https://' + project : undefined}><div className="text-sm overflow-ellipsis truncate text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">{project || 'Unknown'}</div></a>
            </Tooltip>
        </ItemField>
        <ItemField className="w-4/12 flex flex-col">
            <div className="text-gray-500 dark:text-gray-400 overflow-ellipsis truncate">{ws.description}</div>
            <a href={ws.contextURL}>
                <div className="text-sm text-gray-400 dark:text-gray-500 overflow-ellipsis truncate hover:text-blue-600 dark:hover:text-blue-400">{ws.contextURL}</div>
            </a>
        </ItemField>
        <ItemField className="w-2/12 flex flex-col">
            <div className="text-gray-500 dark:text-gray-400 overflow-ellipsis truncate">{currentBranch}</div>
            <div className="mr-auto"><PendingChangesDropdown workspaceInstance={desc.latestInstance} /></div>
        </ItemField>
        <ItemField className="w-2/12 flex">
            <Tooltip content={`Created ${moment(desc.workspace.creationTime).fromNow()}`}>
                <div className="text-sm w-full text-gray-400 overflow-ellipsis truncate">{moment(WorkspaceInfo.lastActiveISODate(desc)).fromNow()}</div>
            </Tooltip>
        </ItemField>
        <ItemFieldContextMenu menuEntries={menuEntries} />
        {isModalVisible && <ConfirmationModal
            title="Delete Workspace"
            areYouSureText="Are you sure you want to delete this workspace?"
            children={{
                name: ws.id,
                description: ws.description,
            }}
            buttonText="Delete Workspace"
            visible={isModalVisible}
            onClose={() => setModalVisible(false)}
            onConfirm={() => model.deleteWorkspace(ws.id)}
        />}
    </Item>;
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
    const conditions = instance?.status?.conditions;
    let stateClassName = 'rounded-full w-3 h-3 text-sm align-middle';
    switch (state) {
        case 'running': {
            stateClassName += ' bg-green-500'
            break;
        }
        case 'stopped': {
            if (conditions?.failed) {
                stateClassName += ' bg-red-400'
            } else {
                stateClassName += ' bg-gray-400'
            }
            break;
        }
        case 'interrupted': {
            stateClassName += ' bg-red-400'
            break;
        }
        case 'unknown': {
            stateClassName += ' bg-red-400'
            break;
        }
        default: {
            stateClassName += ' bg-gitpod-kumquat animate-pulse'
            break;
        }
    }
    return <div className="m-auto">
        <Tooltip content={getLabel(state, conditions)}>
            <div className={stateClassName} />
        </Tooltip>
    </div>;
}