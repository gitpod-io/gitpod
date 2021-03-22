import React, { Suspense, useContext, useEffect, useState } from 'react';
import Menu from './components/Menu';
import { BrowserRouter } from "react-router-dom";
import { Route, Switch } from "react-router";
import { Workspaces } from './workspaces/Workspaces';
import { CreateWorkspace } from './start/CreateWorkspace';
import StartWorkspace from './start/StartWorkspace';
import { Login } from './Login';
import { UserContext } from './user-context';
import { gitpodService } from './service/service';

const Account = React.lazy(() => import('./settings/Account'));
const Notifications = React.lazy(() => import('./settings/Notifications'));
const Plans = React.lazy(() => import('./settings/Plans'));
const EnvironmentVariables = React.lazy(() => import('./settings/EnvironmentVariables'));
const GitIntegrations = React.lazy(() => import('./settings/GitIntegrations'));
const DefaultIDE = React.lazy(() => import('./settings/DefaultIDE'));

function Loading() {
    return (<h3>Loading...</h3>);
}

function App() {
    const { user, setUser } = useContext(UserContext);

    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        (async () => {
            try {
                const user = await gitpodService.server.getLoggedInUser();
                setUser(user);
            } catch (error) {
                console.log(error);
            }
            setLoading(false);
        })();
    }, []);

    if (!loading && !user) {
        return (<Login gitpodService={gitpodService} />)
    };

    window.addEventListener("hashchange", () => {
      // Refresh on hash change if the path is '/' (new context URL)
      if (window.location.pathname === '/') {
        window.location.reload(true);
      }
    }, false);

    const hash = getURLHash();
    if (window.location.pathname === '/' && hash !== '') {
      return <CreateWorkspace contextUrl={hash} gitpodService={gitpodService}/>;
    }
    if (/\/start\/?/.test(window.location.pathname) && hash !== '') {
      return <StartWorkspace workspaceId={hash} gitpodService={gitpodService}/>;
    }

    return (
        <BrowserRouter>
            <div className="container">
                {user && renderMenu()}

                {loading && (<Loading />)}

                <Suspense fallback={<Loading />}>
                    <Switch>
                        {user && (
                            <React.Fragment>
                                <Route path={["/", "/workspaces"]} exact render={
                                    () => <Workspaces gitpodService={gitpodService} />} />
                                <Route path="/account" exact component={Account} />
                                <Route path="/notifications" exact component={Notifications} />
                                <Route path="/plans" exact component={Plans} />
                                <Route path="/variables" exact component={EnvironmentVariables} />
                                <Route path="/integrations" exact component={GitIntegrations} />
                                <Route path="/default-ide" exact component={DefaultIDE} />
                            </React.Fragment>
                        )}
                    </Switch>
                </Suspense>
            </div>
        </BrowserRouter>
    );
}

function getURLHash () {
  return window.location.hash.replace(/^[#/]+/, '');
}

const renderMenu = () => (
    <Menu left={[
        {
            title: 'Workspaces',
            link: '/workspaces'
        },
        {
            title: 'Settings',
            link: '/account'
        },
    ]}
        right={[
            {
                title: 'Docs',
                link: 'https://www.gitpod.io/docs/',
            },
            {
                title: 'Community',
                link: 'https://community.gitpod.io/',
            }
        ]}
    />)

export default App;
