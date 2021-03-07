import { CommitContext, Workspace, WorkspaceInfo, WorkspaceInstance, WorkspaceInstancePhase } from '@gitpod/gitpod-protocol';
import ThreeDots from '../icons/ThreeDots.svg';

export function WorkspaceEntry(desc: WorkspaceInfo) {
    const state: WorkspaceInstancePhase = desc.latestInstance?.status?.phase || 'stopped';
    let stateClassName = 'rounded-full px-3 text-sm leading-relaxed align-middle';
    switch (state) {
        case 'running': {
            stateClassName += ' bg-green-200 text-green-700'
            break;
        }
        case 'stopped': {
            stateClassName += ' bg-gray-200 text-gray-600'
            break;
        }
        case 'interrupted': {
            stateClassName += ' bg-red-200 text-red-600'
            break;
        }
    }
    let changesClassName = '';
    const pendingChanges = getPendingChanges(desc.latestInstance);
    if (pendingChanges.length > 0) {
        changesClassName += ' text-yellow-700';
    }
    const currentBranch = desc.latestInstance?.status.repo?.branch || Workspace.getBranchName(desc.workspace) || '<unknown>';
    const ws = desc.workspace;
    return <div className="whitespace-nowrap flex space-x-2 py-8 border-b-2 border-gray-100 text-gray-800 w-full justify-between hover:bg-gray-100">
        <div className={stateClassName}>
            &nbsp;
        </div>
        <div className="flex flex-col w-3/12">
            <div className="text-gray-900">{ws.id}</div>
            <div className="text-sm overflow-ellipsis truncate text-gray-400">{getProject(ws)}</div>
        </div>
        <div className="flex w-5/12 truncate overflow-ellipsis">
            <div className="pr-1 text-purple-800 font-medium">#</div>
            <div className="flex flex-col">
                <div className="font-medium text-purple-800">{ws.description}</div>
                <div className="text-sm text-gray-400">{ws.contextURL}</div>
            </div>
        </div>
        <div className="flex w-2/12">
            <div className={"pr-1 py-2" + changesClassName}>
                <svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="currentColor"><path strokeWidth="1" d="M21.007 8.222A3.738 3.738 0 0 0 15.045 5.2a3.737 3.737 0 0 0 1.156 6.583 2.988 2.988 0 0 1-2.668 1.67h-2.99a4.456 4.456 0 0 0-2.989 1.165V7.4a3.737 3.737 0 1 0-1.494 0v9.117a3.776 3.776 0 1 0 1.816.099 2.99 2.99 0 0 1 2.668-1.667h2.99a4.484 4.484 0 0 0 4.223-3.039 3.736 3.736 0 0 0 3.25-3.687zM4.565 3.738a2.242 2.242 0 1 1 4.484 0 2.242 2.242 0 0 1-4.484 0zm4.484 16.441a2.242 2.242 0 1 1-4.484 0 2.242 2.242 0 0 1 4.484 0zm8.221-9.715a2.242 2.242 0 1 1 0-4.485 2.242 2.242 0 0 1 0 4.485z" /></svg>
            </div>
            <div className="flex flex-col">
                <div className={changesClassName}>{currentBranch}</div>
                <div className="text-sm text-gray-400">{pendingChanges.toString() || 'No Changes'}</div>
            </div>
        </div>
        <div className="flex w-1/12 self-center space-x-2">
            <div className="w-1/3 hover:bg-gray-200">
                <img className="w-6 h-6" src={ThreeDots} alt="Actions" />
            </div>
        </div>
    </div>;
}


function getPendingChanges(wsi?: WorkspaceInstance): { message: string, items: string[] }[] {
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
        return 'Unknown';
    }
}