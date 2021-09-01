/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { Suspense, useContext, useEffect, useState } from "react";
import { useLocation, useRouteMatch } from "react-router";
import { Project, StartPrebuildResult, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import PrebuildLogs from "../components/PrebuildLogs";
import TabMenuItem from "../components/TabMenuItem";
import { getGitpodService } from "../service/service";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";
import Header from "../components/Header";
import Spinner from "../icons/Spinner.svg";
import SpinnerDark from "../icons/SpinnerDark.svg";
import StatusDone from "../icons/StatusDone.svg";
import StatusPaused from "../icons/StatusPaused.svg";
import StatusRunning from "../icons/StatusRunning.svg";
import PrebuildLogsEmpty from "../images/prebuild-logs-empty.svg";
import PrebuildLogsEmptyDark from "../images/prebuild-logs-empty-dark.svg";
import { ThemeContext } from "../theme-context";

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
  const [ editorMessage, setEditorMessage ] = useState<React.ReactNode | null>(null);
  const [ selectedEditor, setSelectedEditor ] = useState<'.gitpod.yml'|'.gitpod.Dockerfile'>('.gitpod.yml');
  const [ isEditorDisabled, setIsEditorDisabled ] = useState<boolean>(true);
  const [ isDetecting, setIsDetecting ] = useState<boolean>(true);
  const [ prebuildWasTriggered, setPrebuildWasTriggered ] = useState<boolean>(false);
  const [ startPrebuildResult, setStartPrebuildResult ] = useState<StartPrebuildResult | undefined>();
  const [ prebuildPhase, setPrebuildPhase ] = useState<string | undefined>();
  const { isDark } = useContext(ThemeContext);

  useEffect(() => {
    // Disable editing while loading, or when the config comes from Git.
    setIsDetecting(true);
    setIsEditorDisabled(true);
    setEditorMessage(null);
    if (!teams) {
      setIsDetecting(false);
      setEditorMessage(<EditorMessage type="warning" heading="Couldn't load teams information." message="Please try to reload this page." />);
      return;
    }
    (async () => {
      const projects = (!!team
        ? await getGitpodService().server.getTeamProjects(team.id)
        : await getGitpodService().server.getUserProjects());
      const project = projects.find(p => p.name === routeMatch?.params.projectSlug);
      if (!project) {
        setIsDetecting(false);
        setEditorMessage(<EditorMessage type="warning" heading="Couldn't load project information." message="Please try to reload this page." />);
        return;
      }
      setProject(project);
      const guessedConfigStringPromise = getGitpodService().server.guessProjectConfiguration(project.id);
      const repoConfigString = await getGitpodService().server.fetchProjectRepositoryConfiguration(project.id);
      if (repoConfigString) {
        setIsDetecting(false);
        setEditorMessage(<EditorMessage type="warning" heading="Configuration already exists in git." message="Run a prebuild or open a new workspace to edit project configuration."/>);
        setGitpodYml(repoConfigString);
        return;
      }
      if (project.config && project.config['.gitpod.yml']) {
        setIsDetecting(false);
        setIsEditorDisabled(false);
        setGitpodYml(project.config['.gitpod.yml']);
        return;
      }
      const guessedConfigString = await guessedConfigStringPromise;
      setIsDetecting(false);
      setIsEditorDisabled(false);
      if (guessedConfigString) {
        setEditorMessage(<EditorMessage type="success" heading="Project type detected." message="You can edit project configuration below before running a prebuild"/>);
        setGitpodYml(guessedConfigString);
        return;
      }
      setEditorMessage(<EditorMessage type="warning" heading="Project type could not be detected." message="You can edit project configuration below before running a prebuild."/>);
      setGitpodYml(TASKS.Other);
    })();
  }, [ teams, team ]);

  const buildProject = async (event: React.MouseEvent) => {
    if (!project) {
      return;
    }
    // (event.target as HTMLButtonElement).disabled = true;
    setEditorMessage(null);
    if (!!startPrebuildResult) {
      setStartPrebuildResult(undefined);
    }
    try {
      setPrebuildWasTriggered(true);
      if (!isEditorDisabled) {
        await getGitpodService().server.setProjectConfiguration(project.id, gitpodYml);
      }
      const result = await getGitpodService().server.triggerPrebuild(project.id, null);
      setStartPrebuildResult(result);
    } catch (error) {
      setPrebuildWasTriggered(false);
      setEditorMessage(<EditorMessage type="warning" heading="Could not run prebuild." message={String(error).replace(/Error: Request \w+ failed with message: /, '')}/>);
    }
  }

  const onInstanceUpdate = (instance: WorkspaceInstance) => {
    setPrebuildPhase(instance.status.phase);
  }

  useEffect(() => { document.title = 'Configure Project — Gitpod' }, []);

  return <>
    <Header title="Configuration" subtitle="View and edit project configuration." />
    <div className="lg:px-28 px-10 mt-8 flex space-x-4">
      <div className="flex-1 h-96 rounded-xl overflow-hidden relative flex flex-col">
        <div className="flex bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 px-6 pt-3">
          <TabMenuItem name=".gitpod.yml" selected={selectedEditor === '.gitpod.yml'} onClick={() => setSelectedEditor('.gitpod.yml')} />
          {!!dockerfile && <TabMenuItem name=".gitpod.Dockerfile" selected={selectedEditor === '.gitpod.Dockerfile'} onClick={() => setSelectedEditor('.gitpod.Dockerfile')} />}
        </div>
        {editorMessage}
        <Suspense fallback={<div />}>
          {selectedEditor === '.gitpod.yml' &&
            <MonacoEditor classes="w-full flex-grow" disabled={isEditorDisabled} language="yaml" value={gitpodYml} onChange={setGitpodYml} />}
          {selectedEditor === '.gitpod.Dockerfile' &&
            <MonacoEditor classes="w-full flex-grow" disabled={isEditorDisabled} language="dockerfile" value={dockerfile} onChange={setDockerfile} />}
        </Suspense>
        {isDetecting && <div className="absolute h-full w-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center space-x-2">
          <img className="h-5 w-5 animate-spin" src={isDark ? SpinnerDark : Spinner} />
          <span className="font-semibold text-gray-400">Detecting project configuration ...</span>
        </div>}
      </div>
      <div className="flex-1 h-96 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex flex-col">
        <div className="flex-grow flex">{startPrebuildResult
          ? <PrebuildLogs workspaceId={startPrebuildResult.wsid} onInstanceUpdate={onInstanceUpdate} />
          : <div className="flex-grow flex flex-col items-center justify-center">
              <img className="w-14" role="presentation" src={isDark ? PrebuildLogsEmptyDark : PrebuildLogsEmpty} />
              <h3 className="text-center text-lg text-gray-500 dark:text-gray-50 mt-4">No Recent Prebuild</h3>
              <p className="text-center text-base text-gray-500 dark:text-gray-400 mt-2 w-64">Edit the project configuration on the left to get started. <a className="gp-link" href="https://www.gitpod.io/docs/config-gitpod-file/">Learn more</a></p>
            </div>
        }</div>
        <div className="h-20 px-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 flex space-x-2">
          {prebuildWasTriggered && <PrebuildStatus prebuildPhase={prebuildPhase} isDark={isDark} />}
          <div className="flex-grow" />
          <button className="secondary">New Workspace</button>
          <button disabled={isDetecting} onClick={buildProject}>Run Prebuild</button>
        </div>
      </div>
    </div>
  </>;
}

function EditorMessage(props: { heading: string, message: string, type: 'success' | 'warning' }) {
  return <div className={`p-4 flex flex-col ${props.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
    <strong className={`font-semibold ${props.type === 'success' ? 'text-green-800' : 'text-yellow-800'}`}>{props.heading}</strong>
    <span>{props.message}</span>
  </div>;
}

function PrebuildStatus(props: { prebuildPhase?: string, isDark?: boolean }) {
  let status = <></>;
  let details = <></>;
  switch (props.prebuildPhase) {
    case undefined: // Fall through
    case 'unknown':
      status = <div className="flex space-x-1 items-center text-yellow-600">
        <img className="h-4 w-4" src={StatusPaused} />
        <span>PENDING</span>
      </div>;
      details = <div className="flex space-x-1 items-center text-gray-400">
        <img className="h-4 w-4 animate-spin" src={props.isDark ? SpinnerDark : Spinner} />
        <span>Prebuild in progress ...</span>
      </div>;
      break;
    case 'preparing': // Fall through
    case 'pending': // Fall through
    case 'creating': // Fall through
    case 'initializing': // Fall  through
    case 'running': // Fall through
    case 'interrupted':
      status = <div className="flex space-x-1 items-center text-blue-600">
        <img className="h-4 w-4" src={StatusRunning} />
        <span>RUNNING</span>
      </div>;
      details = <div className="flex space-x-1 items-center text-gray-400">
        <img className="h-4 w-4 animate-spin" src={props.isDark ? SpinnerDark : Spinner} />
        <span>Prebuild in progress ...</span>
      </div>;
      break;
    case 'stopping': // Fall through
    case 'stopped':
      status = <div className="flex space-x-1 items-center text-green-600">
        <img className="h-4 w-4" src={StatusDone} />
        <span>READY</span>
      </div>;
      // TODO(janx): Calculate actual duration from prebuild instance.
      details = <div className="flex space-x-1 items-center text-gray-400">
        <img className="h-4 w-4 filter-grayscale" src={StatusRunning} />
        <span>00:34</span>
      </div>;
      break;
  }
  return <div className="flex flex-col space-y-1 justify-center text-sm font-semibold">
    <div>{status}</div>
    <div>{details}</div>
  </div>;
}
