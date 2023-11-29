# devserver

The intention of this experiment was to see if there is an easy-ish way to start all services required to run the API in-workspace, with the primary goal to aid dashboard development.

This was time-boxed, so there is quite a bunch of ToDos left:

 - add (and remove) DNS entries for proxy routing in /etc/hosts (form: `server.devserver.localdomain`)
   - or find another way to introduce variance to the Caddyfile
 - resolve port clashes
   - e.g. 3001 (dashboard and server)
   - but also 9500, etc.
 - introduce ssl+https variance to proxy Caddyfile so we can disable it
 - server:
   - retrieve/generate auth-pki config
   - retrieve auth config
 - proper startup sequencing
   - currently e.g. server sometimes fails, because redis and or DB are not up yet
   - but fixing that really feels we are inventing docker compose/kubectl all over again :-)
 - to be really convenient we would need to allow server to do hot-reload, or other means to replace it directly

## Blocker: OAuth

Even if we fixed all of the above: You still can't login, because of the OAuth flow: We don't have a stable domain name for the workspace, so you'd have to adjust your GitHub app and update the credentials for every workspace.

We could modify our staging proxy (the one we are using for previews right no, where we basically have the same problem). But that's more effort than we want to spent atm.
Interestingly, we will have the same issue with either a) nextgen-based workspace (solving this problem for us only), or b) a Gitpod feature called "preview environments".
So really might be worth looking at this problem first, and solving it in-product?

## Try and see

 1. add these lines to your `/etc/hosts`:
   ```
   127.0.0.1 server.devserver.localdomain
    127.0.0.1 dashboard.devserver.localdomain
   ```
 1. get tls.crt and tls.key, by copying them from a preview into components/server/dev/auth-pki/signing/(tls.crt/tls.key)
 1. get public auth providers by copying for a preview into components/server/dev/authproviders/public-github (etc.)
 1. `cd dev/devserver` and run `./devserver.go $(gp url 80)`

This should bring you to the login screen, with websocket connection established (HMR seems to be connected as well!). Login does not work because of app-problems above.
