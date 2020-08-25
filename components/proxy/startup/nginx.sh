#!/bin/bash
# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


# If not set, read nameserver from resolv.conf (set by kubernetes)
if [ "$NAMESERVER" == "" ]; then
    export NAMESERVER=`cat /etc/resolv.conf | grep "nameserver" | awk '{print $2}' | tr '\n' ' '`
fi

export PROXY_DOMAIN_REGEX=${PROXY_DOMAIN//./\\.}
export PROXY_DOMAIN_COOKIE=${PROXY_DOMAIN//-/_}
export PROXY_DOMAIN_COOKIE=_${PROXY_DOMAIN_COOKIE//./_}_
ORG_PATH=$PWD
cd /etc/nginx/

replaceEnvVars() {
    echo "Updating $i"
    envsubst '$KUBE_NAMESPACE,$PROXY_DOMAIN_REGEX,$PROXY_DOMAIN_COOKIE,$NAMESERVER,$SERVER_PROXY_APIKEY' < $1 > /tmp/foo;
    cp -f /tmp/foo $i
}

### nginx config
# Clear existing config
rm -Rf /etc/nginx/conf.d
rm -Rf /etc/nginx/lib
rm /etc/nginx/nginx.conf

# Copy the gitpod-core config
# (-L does "unlink" and copies the target, not the symlink)
cp -RL /mnt/nginx/* /etc/nginx/

# Copy content of other configmaps if there: Copy it, too
if [ -d "/mnt/configmaps" ]; then
    find /mnt/configmaps/*/* -maxdepth 1 | xargs -I % cp -RL % /etc/nginx/
fi

# Make readable and substitute variables
chmod -R +r /etc/nginx/
for i in $(find . -name "*.conf"); do
    replaceEnvVars $i
done

### create certbot certificate
if [ ! -z "${CERTBOT_ENABLED}" ]; then
    lama -d /var/www/lama -p 8003 &
    LAMA_PID=$!
    sleep 10
    certbot certonly --standalone --non-interactive -d ${PROXY_DOMAIN} -m ${CERTBOT_EMAIL} --agree-tos
    kill -9 $LAMA_PID
    mkdir -p /etc/nginx/certificates
    cp -RL /etc/letsencrypt/archive/${PROXY_DOMAIN}/*.pem /etc/nginx/certificates/
    chmod -R +r /etc/nginx/certificates
fi

### certificates
if [ -d /mnt/nginx/certificates/ ]; then
    mkdir -p /etc/nginx/certificates;
    cp -RL /mnt/nginx/certificates/*.pem /etc/nginx/certificates/
    chmod -R +r /etc/nginx/certificates
fi

if [[ "$PROXY_DOMAIN" =~ .*ip.mygitpod.com ]]; then
    echo "Domain is a ip.mygitpod.com domain - installing HTTPS certs"
    mkdir -p /etc/nginx/certificates
    cp /nodomain-certs/* /etc/nginx/certificates/
fi

### htpasswd for registry
if [ -d /mnt/nginx/registry-auth ]; then
    cat /mnt/nginx/registry-auth/password | htpasswd -i -c /etc/nginx/registry-auth.htpasswd `cat /mnt/nginx/registry-auth/user`
fi

echo "Using nginx config:"
find . -name "*.conf"


cd $ORG_PATH

echo "Starting nginx"
exec nginx -g "daemon off;"