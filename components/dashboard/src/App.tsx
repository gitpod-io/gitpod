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

const Notifications = React.lazy(() => import('./account/Notifications'));
const Profile = React.lazy(() => import('./account/Profile'));
const Subscriptions = React.lazy(() => import('./account/Subscriptions'));
const DefaultIDE = React.lazy(() => import('./settings/DefaultIDE'));
const EnvVars = React.lazy(() => import('./settings/EnvVars'));
const FeaturePreview = React.lazy(() => import('./settings/FeaturePreview'));
const GitIntegration = React.lazy(() => import('./settings/GitIntegration'));

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
    const hash = window.location.hash.replace(/^[#/]+/, '');
    if (window.location.pathname === '/' && hash !== '') {
      return <CreateWorkspace contextUrl={hash} gitpodService={gitpodService}/>;
    }
    if (/\/start\/?/.test(window.location.pathname)) {
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
                                <Route path="/profile" exact component={Profile} />
                                <Route path="/notifications" exact component={Notifications} />
                                <Route path="/subscriptions" exact component={Subscriptions} />
                                <Route path="/env-vars" exact component={EnvVars} />
                                <Route path="/git-integration" exact component={GitIntegration} />
                                <Route path="/feature-preview" exact component={FeaturePreview} />
                                <Route path="/default-ide" exact component={DefaultIDE} />
                            </React.Fragment>
                        )}
                    </Switch>
                </Suspense>
            </div>
        </BrowserRouter>
    );
}

const renderMenu = () => (
    <Menu left={[
        {
            title: 'Workspaces',
            link: '/'
        },
        {
            title: 'Settings',
            link: '/profile'
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
