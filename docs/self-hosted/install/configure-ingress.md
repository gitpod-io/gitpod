---
url: /docs/self-hosted/latest/install/configure-ingress/
---

# Configure Ingress to your Gitpod installation

Configuring ingress into your Gitpod installation requires two things:
 - three DNS entries pointing at the IP of Gitpod's proxy service, and
 - HTTPS certificates.

## 1. DNS Entries
Gitpod requires a domain resolvable by some nameserver (typically a public domain name, e.g. `your-domain.com`).
As Gitpod launches services and workspaces on additional subdomains it also needs two wildcard domains.
For example:

    your-domain.com
    *.your-domain.com
    *.ws.your-domain.com

Installing Gitpod on a subdomain works as well. For example:

    gitpod.your-domain.com
    *.gitpod.your-domain.com
    *.ws.gitpod.your-domain.com

 1. Setup `A` records for all three (sub)domains. To learn your installation's IP run:
    ```
    kubectl describe svc proxy | grep -i ingress
    ```

 2. Create a file `values.custom.yaml` with the following content:
    ```yaml
    hostname: your-domain.com
    ```

## 2. HTTPS
Gitpod requires HTTPS certificates to function properly. We recommend using [Let's Encrypt](https://letsencrypt.org/) for retrieving certificates as we do for [gitpod.io](https://gitpod.io).

> Important: The HTTPS certificates for your domain must include `your-domain.com`, `*.your-domain.com` and `*.ws.your-domain.com`. Beware that wildcard certificates are valid for one level only (i.e. `*.a.com` is not valid for `c.b.a.com`).

To configure the HTTPS certificates for your domain
 1. [Generate certificates](#using-lets-encrypt-to-generate-https-certificates) and put your certificate files under `secrets/https-certificates/`:
    ```
    secrets/https-certificates:
      |- cert.pem
      |- chain.pem
      |- fullchain.pem
      |- privkey.pem
    ```
 2. Generate the [dhparams.pem](https://security.stackexchange.com/questions/94390/whats-the-purpose-of-dh-parameters) file using:
    ```bash
    openssl dhparam -out secrets/https-certificates/dhparams.pem 2048
    ```
 3. Create a kubernetes secret using:
    ```bash
    kubectl create secret generic https-certificates --from-file=secrets/https-certificates
    ```
 4. Afterwards, do an `helm upgrade --install -f values.custom.yaml gitpod gitpod.io/gitpod --version=0.8.0` to apply the changes.

### Using Let's Encrypt to generate HTTPS certificates

The most accessible means of obtaining HTTPS certificates is using [Let's Encrypt](https://letsencrypt.org/). It provides free certificates to anybody who can prove ownership of a domain.
Let's Encrypt offers a program called [certbot](https://certbot.eff.org/) to make acquiring certificates as striaght forward as possible.

Assuming you have [certbot](https://certbot.eff.org/) installed, the following script will generate and configure the required certificates (notice the placeholders):
```bash
export DOMAIN=your-domain.com
export EMAIL=your@email.here
export WORKDIR=$PWD/letsencrypt

certbot certonly \
    --config-dir $WORKDIR/config \
    --work-dir $WORKDIR/work \
    --logs-dir $WORKDIR/logs \
    --manual \
    --preferred-challenges=dns \
    --email $EMAIL \
    --server https://acme-v02.api.letsencrypt.org/directory \
    --agree-tos \
    -d *.ws.$DOMAIN \
    -d *.$DOMAIN \
    -d $DOMAIN

# move them into place
mkdir -p secrets/https-certificates
find $WORKDIR/config/live -name "*.pem" -exec cp {} secrets/https-certificates \;
```

 > Note: Do not refrain if `certbot` fails on first execution: Depending on the challenge used you might have to restart it _once_.
