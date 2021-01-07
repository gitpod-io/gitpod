---
url: /docs/self-hosted/latest/install/configure-ingress/
---

# Configure Ingress to your Gitpod installation

Configuring ingress into your Gitpod installation requires two things: DNS entries and HTTPS certificates.

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

 1. Setup `A` records for all three (sub)domains.

 2. Create a file `values.custom.yaml` with the following content:
    ```yaml
    hostname: your-domain.com
    ```

## 2. HTTPS
Gitpod requires HTTPS certificates to function properly. We recommend using [Let's Encrypt](https://letsencrypt.org/) for retrieving certificates as we do for [gitpod.io](https://gitpod.io).

> Important: The HTTPS certificates for your domain must include `your-domain.com`, `*.your-domain.com` and `*.ws.your-domain.com`. Beware that wildcard certificates are valid for one level only (i.e. `*.a.com` is not valid for `c.b.a.com`).

To configure the HTTPS certificates for your domain
 1. [Generate certificates](#using-let-s-encrypt) and put your certificate files under `secrets/https-certificates/`:
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
 4. Afterwards, do an `helm upgrade --install -f values.custom.yaml gitpod gitpod.io/gitpod` to apply the changes.
 

### Using Let's Encrypt to generate HTTPS certificates

The most accessible means of obtaining HTTPS certificates is using [Let's Encrypt](https://letsencrypt.org/) which provides free certificats to anybody who can prove ownership of a domain.
Gitpod requires [wildcard certificates](https://en.wikipedia.org/wiki/Wildcard_certificate) (e.g. `*.ws.your-domain.com`) which [can be obtained via Let's Encrypt](https://community.letsencrypt.org/t/acme-v2-production-environment-wildcards/55578) but require [proof of ownership via DNS](https://letsencrypt.org/docs/challenge-types/#dns-01-challenge).
There is a [plethora of tutorials](https://www.google.com/search?q=letsencrypt+wildcard) how to [generate wildcard certificates](https://medium.com/@saurabh6790/generate-wildcard-ssl-certificate-using-lets-encrypt-certbot-273e432794d7) using Let's Encrypt.
Things get considerably easier when your domain is registered with a service for which a [Certbot DNS plugin exists](https://certbot.eff.org/docs/using.html#dns-plugins).

Assuming you have [certbot](https://certbot.eff.org/) installed, the following script will generate and configure the required certificates (notice the placeholders):
```bash
export DOMAIN=your-domain.com
export EMAIL=your@email.here
export WORKDIR=/workspace/letsencrypt

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