export enum StartPhase {
  Checking = 0,
  Building = 1,
  Preparing = 2,
  Starting = 3,
  Running = 4,
};

function ProgressBar(props: { phase: number, error: boolean }) {
  return <div className="flex mt-8 mb-6">
    {[1, 2, 3].map(i => {
      let classes = 'h-2 w-10 m-2 rounded-full';
      if (i < props.phase) {
        // Already passed this phase successfully
        classes += ' bg-green-light';
      } else if (i > props.phase) {
        // Haven't reached this phase yet
        classes += ' bg-gray-200';
      } else if (props.error) {
        // This phase has failed
        classes += ' bg-red';
      } else {
        // This phase is currently running
        classes += ' bg-green-light animate-pulse';
      }
      return <div className={classes}/>;
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
  switch (props.phase) {
    case StartPhase.Checking:
      if (props.error) {
        // Pre-check error
        title = "Oh, no! Something went wrong!1";
      }
      break;
    case StartPhase.Building:
      title = "Building";
      break;
    case StartPhase.Preparing:
      title = "Preparing";
      break;
    case StartPhase.Starting:
      title = "Starting";
      break;
  }
  return <div className="h-screen flex bg-white">
    <div className="w-full mt-40 md:mt-60 flex flex-col items-center">
      <img src="/gitpod.svg" className="h-16 flex-shrink-0" />
      <h3 className="mt-8">{title}</h3>
      <ProgressBar phase={props.phase} error={!!props.error}/>
      {props.children}
    </div>
  </div>;
}
