import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "./user-context";
import { gitpodHostUrl } from "./service/service";

export function Login({ gitpodService }: { gitpodService: GitpodService }) {
    const { setUser } = useContext(UserContext);

    const [authProviders, setAuthProviders] = useState<AuthProviderInfo[]>([]);

    useEffect(() => {
        (async () => {
            setAuthProviders(await gitpodService.server.getAuthProviders());
        })();

        window.addEventListener("message", (event) => {
            // todo: check event.origin

            if (event.data === "auth-success") {
                if (event.source && "close" in event.source && event.source.close) {
                    console.log(`try to close window`);
                    event.source.close();
                } else {
                    // todo: not here, but add a button to the /login-success page to close, if this should not work as expected
                }
                (async () => {
                    gitpodService.reconnect();
                    const user = await gitpodService.server.getLoggedInUser();
                    setUser(user);
                })();
            }
        })
    }, [])

    const openLogin = (host: string) => {
        const url = getLoginUrl(host);
        const newWindow = window.open(url, "gitpod-login");
        if (!newWindow) {
            console.log(`Failed to open login window for ${host}`);
        }
    }

    return (<div id="login-container" className="z-50 flex w-screen h-screen">
        <div id="feature-section" className="flex-grow bg-gray-100 w-1/2">
            <div className="flex flex-col space-y-8 h-full justify-center p-20">
                <div className="flex space-x-2 text-center">
                    <img src="/gitpod.svg" className="h-6 my-1" />
                    <h3>Gitpod</h3>
                </div>
                <div>
                    <h1>Save time<br/> with Prebuilds</h1>
                </div>
                <div className="text-gray-400">
                    Gitpod continuously builds your git branches like a CI server. This means no more waiting for dependencies to be downloaded and builds to finish. Learn more about Prebuilds
                </div>
                <div>
                    {/* pic */}
                </div>
            </div>
        </div>
        <div id="login-section" className="flex-grow flex flex-col w-1/2">

            <div className="flex-grow h-100 flex flex-row items-center justify-center" >
                
                <div className="rounded-xl px-10 py-10 mx-auto">
                    <div className="mx-auto pb-8">
                        <img src="/gitpod.svg" className="h-16 mx-auto" />
                    </div>
                    <div className="mx-auto text-center pb-8 space-y-2">
                        <h1 className="text-3xl">Log in to Gitpod</h1>
                        <h2 className="uppercase">ALWAYS READY-TO-CODE</h2>
                    </div>
                    <div className="flex flex-col space-y-3">
                        {authProviders.map(ap => {
                            return (
                                <button key={"button" + ap.host} className="flex-none w-full rounded-none border-none p-0 inline-flex" onClick={() => openLogin(ap.host)}>
                                    <img className="fill-current w-5 h-5 ml-4 mr-4 my-auto" src={iconForAuthProvider(ap.authProviderType)}/>
                                    <span className="pt-2 pb-2 mr-4 text-base break-words">Continue with {ap.host}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="flex-none mx-auto h-20 text-center">
                <span className="text-gray-400">
                    By signing in, you agree to our <a className="underline" target="gitpod-terms" href="https://www.gitpod.io/terms/">terms of service</a>.
                </span>
            </div>
        </div>
    </div>);
}

function iconForAuthProvider(type: string) {
    switch (type) {
        case "GitHub":
            return "/images/github.svg"
        case "GitLab":
            return "/images/gitlab.svg"
        case "BitBucket":
            return "/images/bitbucket.svg"
        default:
            break;
    }
}

function getLoginUrl(host: string) {
    const returnTo = gitpodHostUrl.with({ pathname: 'login-success'}).toString();
    return gitpodHostUrl.withApi({
        pathname: '/login',
        search: `host=${host}&returnTo=${encodeURIComponent(returnTo)}`
    }).toString();
}