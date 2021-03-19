export enum StartPhase {
  Checking = 0,
  Preparing = 1,
  Creating = 2,
  Starting = 3,
  Running = 4,
  Stopping = 5,
  Stopped = 6,
};

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
        classes += ' bg-gray-200';
      } else if (error) {
        // This phase has failed
        classes += ' bg-red';
      } else {
        // This phase is currently running
        classes += ' bg-green-400 animate-pulse';
      }
      return <div key={'phase-' + i} className={classes} />;
    })}
  </div>;
}

export interface StartPageProps {
  phase: number;
  error?: boolean;
  children?: React.ReactNode;
}

export function StartPage(props: StartPageProps) {
  let title = "";
  const { phase, error } = props;
  switch (phase) {
    case StartPhase.Checking:
      title = "Checking";
      if (error) {
        // Pre-check error
        title = "Oh, no! Something went wrong!1";
      }
      break;
    case StartPhase.Preparing:
      title = "Preparing";
      break;
    case StartPhase.Creating:
      title = "Creating";
      break;
    case StartPhase.Starting:
      title = "Starting";
      break;
    case StartPhase.Running:
      title = "Starting";
      break;
    case StartPhase.Stopping:
      title = "Stopping";
      break;
    case StartPhase.Stopped:
      title = "Stopped";
      break;
  }
  return <div className="w-screen h-screen bg-white align-middle">
    <div className="flex flex-col mx-auto items-center h-screen">
      <div className="h-1/3"></div>
      <img src="/gitpod.svg" className={`h-16 flex-shrink-0 ${(error || phase === StartPhase.Stopped) ? '' : 'animate-bounce'}`} />
      <h3 className="mt-8 text-xl">{title}</h3>
      {(phase < StartPhase.Stopping) && <ProgressBar phase={phase} error={!!error} />}
      {props.children}
    </div>
  </div>;
}
