import React, { Suspense, useContext, useEffect, useState } from 'react';
import Menu from './components/Menu';
import { BrowserRouter, Route, Switch } from "react-router-dom";
import { Workspaces } from './workspaces/Workspaces';
import { Login } from './Login';
import { UserContext } from './contexts';
import { gitpodService, service } from './service/service';

const Notifications = React.lazy(() => import('./account/Notifications'));
const Profile = React.lazy(() => import('./account/Profile'));
const Subscriptions = React.lazy(() => import('./account/Subscriptions'));
const DefaultIDE = React.lazy(() => import('./settings/DefaultIDE'));
const EnvVars = React.lazy(() => import('./settings/EnvVars'));
const FeaturePreview = React.lazy(() => import('./settings/FeaturePreview'));
const GitIntegration = React.lazy(() => import('./settings/GitIntegration'));

function App() {
    const { user, setUser } = useContext(UserContext);

    const [loading, setLoading] = useState<boolean>(true);
    const [userLoadError, setUserLoadError] = useState<string | undefined>(undefined);

    useEffect(() => {
        (async () => {
            try {
                const user = await service.getOrLoadUser();
                setUser(user);
            } catch (error) {
                console.log(error);
                setUserLoadError(error && error.message);
            }
            setLoading(false);
        })();
    }, []);


    return (
        <BrowserRouter>
            <div className="container">
                {user && renderMenu()}

                {loading && (<h3>Loading...</h3>)}
                {userLoadError && (<div><h2>Error</h2><h2>{userLoadError}</h2></div>)}

                <Suspense fallback={<h3>Loading...</h3>}>
                    <Switch>
                        {user && (
                            <React.Fragment>
                                <Route path="/" exact render={
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
                        {!user && (
                            <React.Fragment>
                                <Route path="/" exact render={() => <Login />} />
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
