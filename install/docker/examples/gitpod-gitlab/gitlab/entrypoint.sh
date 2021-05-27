#!/bin/sh
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.


set -eu

if [ -z "$BASEDOMAIN" ]; then
    >&2 echo "Error: You need to set the environment variable BASEDOMAIN."
    exit 1
fi


# Fix volume ownerships
[ -d "/var/gitlab/gitaly" ] && chown 1000 /var/gitlab/gitaly
[ -d "/var/gitlab/minio" ] && chown 1000 /var/gitlab/minio
[ -d "/var/gitlab/postgresql" ] && chown 1001 /var/gitlab/postgresql
[ -d "/var/gitlab/redis" ] && chown 1001 /var/gitlab/redis


# Add IP tables rules to access Docker's internal DNS 127.0.0.11 from outside
# based on https://serverfault.com/a/826424

TCP_DNS_ADDR=$(iptables-save | grep DOCKER_OUTPUT | grep tcp | grep -o '127\.0\.0\.11:.*$')
UDP_DNS_ADDR=$(iptables-save | grep DOCKER_OUTPUT | grep udp | grep -o '127\.0\.0\.11:.*$')

iptables -t nat -A PREROUTING -p tcp --dport 53 -j DNAT --to "$TCP_DNS_ADDR"
iptables -t nat -A PREROUTING -p udp --dport 53 -j DNAT --to "$UDP_DNS_ADDR"


# Add this IP to resolv.conf since CoreDNS of k3s uses this file

TMP_FILE=$(mktemp)
sed "/nameserver.*/ a nameserver $(hostname -i | cut -f1 -d' ')" /etc/resolv.conf > "$TMP_FILE"
cp "$TMP_FILE" /etc/resolv.conf
rm "$TMP_FILE"



# prepare GitLab helm installer
GITLAB_HELM_INSTALLER_FILE=/var/lib/rancher/k3s/server/manifests/gitlab-helm-installer.yaml

sed -i "s/\$BASEDOMAIN/$BASEDOMAIN/g" "$GITLAB_HELM_INSTALLER_FILE"

cat << EOF > /insert_oauth_application.sql
INSERT INTO oauth_applications (name, uid, secret, redirect_uri, scopes, created_at, updated_at, owner_id, owner_type)
VALUES (
    'Gitpod',
    '2ce8bfb95d9a1e0ed305427f35e10a6bdd1eef090b1890c68e5f8370782d05ee',
    'a5447d23643f7e71353d9fc3ad1c15464c983c47f6eb2e80dd37de28152de05e',
    'https://gitpod.$BASEDOMAIN/auth/gitlab/callback',
    'api read_user read_repository',
    now(), now(), 1, 'User'
);
EOF

insertoauth () {
    echo "Waiting for GitLab DB migrations ..."
    # shellcheck disable=SC2143
    while [ -z "$(kubectl get pods | grep gitlab-migrations | grep Completed)" ]; do sleep 10; done

    echo "Adding OAuth application to DB ..."
    SQL=$(cat /insert_oauth_application.sql)
    DBPASSWD=$(kubectl get secret gitlab-postgresql-password -o jsonpath='{.data.postgresql-postgres-password}' | base64 --decode)
    kubectl exec -it gitlab-postgresql-0 -- bash -c "PGPASSWORD=$DBPASSWD psql -U postgres -d gitlabhq_production -c \"$SQL\""
    echo "OAuth application added to DB."
}
insertoauth &

installation_completed_hook() {
    # shellcheck disable=SC2143
    while [ -z "$(kubectl get pods --all-namespaces | grep helm-install-gitlab | grep Completed)" ]; do sleep 10; done

    echo "Removing installer manifest ..."
    rm -f /var/lib/rancher/k3s/server/manifests/gitlab-helm-intaller.yaml


    echo "Backup secrets ..."
    mkdir -p /var/gitlab/secrets-backup && cd /var/gitlab/secrets-backup
    # shellcheck disable=SC2143
    while [ -z "$(kubectl get secrets gitlab-rails-secret | grep Opaque)" ]; do sleep 10; done
    [ -f gitlab-rails-secret ] && cp gitlab-rails-secret .gitlab-rails-secret_"$(date -Iseconds)".backup
    printf "secrets.yml: %s\n" "$(kubectl get secrets gitlab-rails-secret -o jsonpath="{.data['secrets\.yml']}")" > gitlab-rails-secret
    # shellcheck disable=SC2143
    while [ -z "$(kubectl get secrets gitlab-postgresql-password | grep Opaque)" ]; do sleep 10; done
    [ -f gitlab-postgresql-password ] && cp gitlab-postgresql-password .gitlab-postgresql-password_"$(date -Iseconds)".backup
    printf "postgresql-password: %s\n" "$(kubectl get secrets gitlab-postgresql-password -o jsonpath='{.data.postgresql-password}')" > gitlab-postgresql-password
    printf "postgresql-postgres-password: %s\n" "$(kubectl get secrets gitlab-postgresql-password -o jsonpath='{.data.postgresql-postgres-password}')" >> gitlab-postgresql-password
    # shellcheck disable=SC2143
    while [ -z "$(kubectl get secrets gitlab-gitlab-runner-secret | grep Opaque)" ]; do sleep 10; done
    [ -f gitlab-gitlab-runner-secret ] && cp gitlab-gitlab-runner-secret .gitlab-gitlab-runner-secret_"$(date -Iseconds)".backup
    printf "runner-registration-token: %s\n" "$(kubectl get secrets gitlab-gitlab-runner-secret -o jsonpath='{.data.runner-registration-token}')" > gitlab-gitlab-runner-secret
    printf "runner-token: %s\n" "$(kubectl get secrets gitlab-gitlab-runner-secret -o jsonpath='{.data.runner-token}')" >> gitlab-gitlab-runner-secret
    # shellcheck disable=SC2143
    while [ -z "$(kubectl get secrets gitlab-gitlab-initial-root-password | grep Opaque)" ]; do sleep 10; done
    [ -f gitlab-gitlab-initial-root-password ] && cp gitlab-gitlab-initial-root-password .gitlab-gitlab-initial-root-password_"$(date -Iseconds)".backup
    printf "password: %s\n" "$(kubectl get secrets gitlab-gitlab-initial-root-password -o jsonpath='{.data.password}')" > gitlab-gitlab-initial-root-password
}
installation_completed_hook &


# add HTTPS certs secret
FULLCHAIN=$(base64 --wrap=0 < /certs/fullchain.pem)
PRIVKEY=$(base64 --wrap=0 < /certs/privkey.pem)
cat << EOF > /var/lib/rancher/k3s/server/manifests/tls-certs.yaml
apiVersion: v1
kind: Secret
metadata:
  name: tls-certs
type: tls
data:
  cert: $FULLCHAIN
  key: $PRIVKEY
EOF


# restore secrets
if [ -d /var/gitlab/secrets-backup ]; then
    cd /var/gitlab/secrets-backup
    # shellcheck disable=SC2045
    for s in $(ls); do
        echo "Restoring secret $s ..."
        cat << EOF > "/var/lib/rancher/k3s/server/manifests/$s.yaml"
apiVersion: v1
kind: Secret
metadata:
  name: $s
  labels:
    app: shared-secrets
type: Opaque
data:
EOF
        sed 's/^/  /' "$s" >> "/var/lib/rancher/k3s/server/manifests/$s.yaml"
    done
    cd -
fi


# start k3s
/bin/k3s server --disable traefik
