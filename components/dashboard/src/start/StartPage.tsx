/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useEffect } from 'react';
import gitpodIcon from '../icons/gitpod.svg';

export enum StartPhase {
  Checking = 0,
  Preparing = 1,
  Creating = 2,
  Starting = 3,
  Running = 4,
  IdeReady = 5,
  Stopping = 6,
  Stopped = 7,
};

function getPhaseTitle(phase?: StartPhase, error?: StartWorkspaceError) {
  if (!!error) {
    return "Oh, no! Something went wrong!";
  }
  switch (phase) {
    case StartPhase.Checking:
      return "Checking";
    case StartPhase.Preparing:
      return "Preparing";
    case StartPhase.Creating:
      return "Creating";
    case StartPhase.Starting:
      return "Starting";
    case StartPhase.Running:
      return "Starting";
    case StartPhase.IdeReady:
      return "Your Workspace is Ready!";
    case StartPhase.Stopping:
      return "Stopping";
    case StartPhase.Stopped:
      return "Stopped";
    default:
      return "";
  }
}

function ProgressBar(props: { phase: number, error: boolean }) {
  const { phase, error } = props;
  return <div className="flex mt-4 mb-6">
    {[1, 2, 3].map(i => {
      let classes = 'h-2 w-10 mx-1 my-2 rounded-full';
      if (i < phase) {
        // Already passed this phase successfully
        classes += ' bg-green-400';
      } else if (i > phase) {
        // Haven't reached this phase yet
        classes += ' bg-gray-200 dark:bg-gray-800';
      } else if (error) {
        // This phase has failed
        classes += ' bg-red-500';
      } else {
        // This phase is currently running
        classes += ' bg-green-400 animate-pulse';
      }
      return <div key={'phase-' + i} className={classes} />;
    })}
  </div>;
}

export interface StartPageProps {
  phase?: number;
  error?: StartWorkspaceError;
  title?: string;
  children?: React.ReactNode;
}

export interface StartWorkspaceError {
  message?: string;
  code?: number;
  data?: any;
}

export function StartPage(props: StartPageProps) {
  const { phase, error } = props;
  let title = props.title || getPhaseTitle(phase, error);
  useEffect(() => { document.title = 'Starting — Gitpod' }, []);
  return <div className="w-screen h-screen align-middle">
    <div className="flex flex-col mx-auto items-center text-center h-screen">
      <div className="h-1/3"></div>
      <img src={gitpodIcon} alt="Gitpod's logo" className={`h-16 flex-shrink-0 ${(error || phase === StartPhase.Stopped || phase === StartPhase.IdeReady) ? '' : 'animate-bounce'}`} />
      <h3 className="mt-8 text-xl">{title}</h3>
      {typeof(phase) === 'number' && phase < StartPhase.IdeReady && <ProgressBar phase={phase} error={!!error} />}
      {error && <StartError error={error} />}
      {props.children}
    </div>
  </div>;
}

function StartError(props: { error: StartWorkspaceError }) {
  const { error } = props;
  if (!error) {
    return null;
  }
  return <p className="text-base text-gitpod-red w-96">{error.message}</p>;
}
