import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import Modal from "./components/Modal";
import { UserContext } from "./user-context";
import { gitpodHostUrl, reconnect, gitpodService } from "./service/service";

export function Login() {
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
                    reconnect();
                    const user = await gitpodService.server.getLoggedInUser();
                    setUser(user);
                })();
            }
        })
    })

    const openLogin = (host: string) => {
        const url = getLoginUrl(host);
        const newWindow = window.open(url, "gitpod-login");
        if (!newWindow) {
            console.log(`Failed to open login window for ${host}`);
        }
    }

    return (<div>
        <Modal visible={true}>
            <div>
                <ol>
                    {authProviders.map(ap => {
                        return (<li key={ap.host}>
                            <h2><a href="#" onClick={() => openLogin(ap.host)}>Continue with {ap.host}</a></h2>
                        </li>);
                    })}
                </ol>
            </div>
        </Modal>
    </div>);
}

function getLoginUrl(host: string) {
    const returnTo = gitpodHostUrl.with({ pathname: 'login-success'}).toString();
    return gitpodHostUrl.withApi({
        pathname: '/login',
        search: `host=${host}&returnTo=${encodeURIComponent(returnTo)}`
    }).toString();
}