import React from 'react';

export interface Service {
    getUser(): User;
    getWorkspaces(active: boolean): WorkspaceDescription[]; 
  }

export interface User {
    userName: string;
    name: string;
    email: string;
    avatarUrl: string;
}

export interface WorkspaceDescription {
    id: string,
    project: string,
    contextTitle: string,
    contextName: string,
    currentBranch: string,
    currentChanges?: string,
    state: 'Running' | 'Stopped' | 'Error' | 'Stopping' | 'Starting',
    since: string,
    shared: boolean,
    pinned: boolean
}

export class SimpleServiceImpl implements Service {
    getUser(): User {
        return {
            name: 'Andy Leverenz',
            email: 'andy@leverenz.com',
            userName: 'aleverenz',
            avatarUrl: 'https://avatars.githubusercontent.com/u/5750?s=400&u=95c71e43d35f4b2f7ea95474f5058bb51986f556&v=4'
        };
    }
    getWorkspaces(active: boolean): WorkspaceDescription[] {
        if (active) {
            return activeWorkspaces;
        } else {
            return recentWorkspaces;
        }
    }
}

const activeWorkspaces: WorkspaceDescription[] = [
    {
        id: 'red-puma-324234',
        project: 'github.com/gitpod-io/gitpod',
        contextTitle: 'Long title for the pull request for something that is just way too long',
        contextName: 'Pull Request 2323',
        currentBranch: 'master',
        currentChanges: '3 Commits, 2 Files',
        state: 'Running',
        since: '1 hour ago',
        shared: true,
        pinned: false
    },
    {
        id: 'pink-lion-324234',
        project: 'github.com/gitpod-com/gitpod',
        contextTitle: 'Some short title',
        contextName: 'Isse 47411',
        currentBranch: 'se-foo-bar-4711',
        state: 'Stopped',
        since: '2 days ago',
        shared: false,
        pinned: true
    }
];

const recentWorkspaces: WorkspaceDescription[] = [
    {
        id: 'yellow-puma-324234',
        project: 'github.com/gitpod-com/gitpod',
        contextTitle: 'Foo Bar',
        contextName: 'Pull Request 2323',
        currentBranch: 'master',
        currentChanges: '3 Commits, 2 Files',
        state: 'Stopped',
        since: '1 hour ago',
        shared: true,
        pinned: false
    },
    {
        id: 'brown-lion-324234',
        project: 'github.com/gitpod-io/gitpod',
        contextTitle: 'Long title for the pull request for something that is just way too long',
        contextName: 'Isse 47411',
        currentBranch: 'se-foo-bar-4711',
        state: 'Stopped',
        since: '2 days ago',
        shared: false,
        pinned: false
    },
    {
        id: 'red-puma-324234',
        project: 'github.com/gitpod-io/gitpod',
        contextTitle: 'main',
        contextName: 'Branch main',
        currentBranch: 'master',
        currentChanges: '3 Commits, 2 Files',
        state: 'Error',
        since: '3 weeks ago',
        shared: true,
        pinned: false
    },
];

export const ServiceContext = React.createContext<Service>(new SimpleServiceImpl());