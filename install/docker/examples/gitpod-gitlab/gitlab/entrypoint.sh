#!/bin/sh
# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.


set -eu

if [ -z "$BASEDOMAIN" ]; then
    >&2 echo "Error: You need to set the environment variable BASEDOMAIN."
    exit 1
fi


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
    while [ -z "$(kubectl get pods | grep gitlab-migrations | grep Completed)" ]; do sleep 10; done

    echo "Adding OAuth application to DB ..."
    SQL=$(cat /insert_oauth_application.sql)
    DBPASSWD=$(kubectl get secret gitlab-postgresql-password -o jsonpath='{.data.postgresql-postgres-password}' | base64 --decode)
    kubectl exec -it gitlab-postgresql-0 -- bash -c "PGPASSWORD=$DBPASSWD psql -U postgres -d gitlabhq_production -c \"$SQL\""
    echo "OAuth application added to DB."
}
insertoauth &

installation_completed_hook() {
    while [ -z "$(kubectl get pods --all-namespaces | grep helm-install-gitlab | grep Completed)" ]; do sleep 10; done

    echo "Removing installer manifest ..."
    rm -f /var/lib/rancher/k3s/server/manifests/gitlab-helm-intaller.yaml
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


# patch DNS config if DNSSERVER environment variable is given
if [ -n "$BASEDOMAIN" ] && [ -n "$DNSSERVER" ]; then
    patchdns() {
        echo "Waiting for CoreDNS to patch config ..."
        while [ -z "$(kubectl get pods -n kube-system | grep coredns | grep Running)" ]; do sleep 10; done

        BASEDOMAIN=$1
        DNSSERVER=$2

        if [ -z "$(kubectl get configmap -n kube-system coredns -o json | grep $BASEDOMAIN)" ]; then
            echo "Patching CoreDNS config ..."

            kubectl get configmap -n kube-system coredns -o json | \
                sed -e "s+.:53+$BASEDOMAIN {\\\\n  forward . $DNSSERVER\\\\n}\\\\n.:53+g" | \
                kubectl apply -f -
            echo "CoreDNS config patched."
        else
            echo "CoreDNS has been patched already."
        fi
    }
    patchdns "$BASEDOMAIN" "$DNSSERVER" &
fi

# start k3s
/bin/k3s server --disable traefik --cluster-cidr 10.52.0.0/16 --service-cidr 10.53.0.0/16 --cluster-dns 10.53.0.10
