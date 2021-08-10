/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { Suspense, useContext, useEffect, useState } from "react";
import { useLocation, useRouteMatch } from "react-router";
import { CreateWorkspaceMode, Project, WorkspaceCreationResult } from "@gitpod/gitpod-protocol";
import PrebuildLogs from "../components/PrebuildLogs";
import TabMenuItem from "../components/TabMenuItem";
import { getGitpodService } from "../service/service";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";
import AlertBox from "../components/AlertBox";

const MonacoEditor = React.lazy(() => import('../components/MonacoEditor'));

const TASKS = {
  NPM: `tasks:
  - init: npm install
    command: npm run start`,
  Yarn: `tasks:
  - init: yarn install
    command: yarn run start`,
  Go: `tasks:
  - init: go get && go build ./... && go test ./...
    command: go run`,
  Rails: `tasks:
  - init: bin/setup
    command: bin/rails server`,
  Rust: `tasks:
  - init: cargo build
    command: cargo watch -x run`,
  Python: `tasks:
  - init: pip install -r requirements.txt
    command: python main.py`,
  Other: `tasks:
  - init: # TODO: install dependencies, build project
    command: # TODO: start app`
}

// const IMAGES = {
//   Default: 'gitpod/workspace-full',
//   '.NET': 'gitpod/workspace-dotnet',
//   MongoDB: 'gitpod/workspace-mongodb',
//   MySQL: 'gitpod/workspace-mysql',
//   PostgreSQL: 'gitpod/workspace-postgres',
//   'Virtual Desktop (VNC)': 'gitpod/workspace-full-vnc',
// }

export default function () {
  const { teams } = useContext(TeamsContext);
  const location = useLocation();
  const team = getCurrentTeam(location, teams);
  const routeMatch = useRouteMatch<{ teamSlug: string, projectSlug: string }>("/:teamSlug/:projectSlug/configure");
  const [ project, setProject ] = useState<Project | undefined>();
  const [ gitpodYml, setGitpodYml ] = useState<string>('');
  const [ dockerfile, setDockerfile ] = useState<string>('');
  const [ editorError, setEditorError ] = useState<React.ReactNode | null>(null);
  const [ selectedEditor, setSelectedEditor ] = useState<'.gitpod.yml'|'.gitpod.Dockerfile'>('.gitpod.yml');
  const [ isEditorDisabled, setIsEditorDisabled ] = useState<boolean>(true);
  const [ workspaceCreationResult, setWorkspaceCreationResult ] = useState<WorkspaceCreationResult | undefined>();

  useEffect(() => {
    // Disable editing while loading, or when the config comes from Git.
    setIsEditorDisabled(true);
    setEditorError(null);
    if (!teams) {
      return;
    }
    (async () => {
      const projects = (!!team
        ? await getGitpodService().server.getTeamProjects(team.id)
        : await getGitpodService().server.getUserProjects());
      const project = projects.find(p => p.name === routeMatch?.params.projectSlug);
      if (project) {
        setProject(project);
        getGitpodService().server.guessProjectConfiguration(project.id).then(conf => console.log('guessed', conf)).catch(err => console.error('could not guess', err));
        const configString = await getGitpodService().server.fetchProjectRepositoryConfiguration(project.id);
        if (configString) {
          // TODO(janx): Link to .gitpod.yml directly instead of just the cloneUrl.
          setEditorError(<span>A Gitpod configuration already exists in the project's <a className="gp-link" href={project.cloneUrl}>repository</a>.<br/>Please <a className="gp-link" href={`/#${project.cloneUrl}`}>edit it in Gitpod</a> instead.</span>);
          setGitpodYml(configString);
        } else {
          setIsEditorDisabled(false);
          setGitpodYml(project.config && project.config['.gitpod.yml'] || '');
        }
      }
    })();
  }, [ teams, team ]);

  const buildProject = async (event: React.MouseEvent) => {
    if (!project) {
      return;
    }
    // (event.target as HTMLButtonElement).disabled = true;
    setEditorError(null);
    if (!!workspaceCreationResult) {
      setWorkspaceCreationResult(undefined);
    }
    try {
      await getGitpodService().server.setProjectConfiguration(project.id, gitpodYml);
      const result = await getGitpodService().server.createWorkspace({
        contextUrl: `prebuild/${project.cloneUrl}`,
        mode: CreateWorkspaceMode.ForceNew,
      });
      setWorkspaceCreationResult(result);
    } catch (error) {
      setEditorError(<span>{String(error)}</span>);
    }
  }

  useEffect(() => { document.title = 'Configure Project — Gitpod' }, []);

  return <div className="flex flex-col mt-24 mx-auto items-center">
    <h1>Configure Project</h1>
    <p className="text-gray-500 text-center text-base">Fully-automate your project's dev setup. <a className="gp-link" href="https://www.gitpod.io/docs/references/gitpod-yml">Learn more</a></p>
    <div className="mt-4 w-full flex">
      <div className="flex-1 m-8">
        {editorError && <AlertBox className="mb-2">{editorError}</AlertBox>}
        {!isEditorDisabled && <select className="w-full" defaultValue="" onChange={e => setGitpodYml(e.target.value)}>
          <option value="" disabled={true}>…</option>
          {Object.entries(TASKS).map(([ name, value ]) => <option value={value}>{name}</option>)}
        </select>}
        {!!dockerfile && <div className="flex justify-center border-b border-gray-200 dark:border-gray-800">
          <TabMenuItem name=".gitpod.yml" selected={selectedEditor === '.gitpod.yml'} onClick={() => setSelectedEditor('.gitpod.yml')} />
          <TabMenuItem name=".gitpod.Dockerfile" selected={selectedEditor === '.gitpod.Dockerfile'} onClick={() => setSelectedEditor('.gitpod.Dockerfile')} />
        </div>}
        <Suspense fallback={<div />}>
          {selectedEditor === '.gitpod.yml' &&
            <MonacoEditor classes="mt-4 w-full h-64" disabled={isEditorDisabled} language="yaml" value={gitpodYml} onChange={setGitpodYml} />}
          {selectedEditor === '.gitpod.Dockerfile' &&
            <MonacoEditor classes="mt-4 w-full h-64" disabled={isEditorDisabled} language="dockerfile" value={dockerfile} onChange={setDockerfile} />}
        </Suspense>
        <div className="mt-2 flex justify-center space-x-2">
          <button disabled={isEditorDisabled} onClick={buildProject}>Save &amp; Test Configuration</button>
        </div>
      </div>
      <div className="flex-1 m-8">
        <h3 className="text-center">Output</h3>
        {!!workspaceCreationResult && <PrebuildLogs workspaceId={workspaceCreationResult.createdWorkspaceId} />}
      </div>
    </div>
  </div>;
}
