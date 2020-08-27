---
url: /docs/self-hosted/0.5.0/install/install-on-gcp-manual/
---

# Manually Install Gitpod on Google Cloud Platform

  > **TODO** This document is a stub only.

## Before you begin
 - install [gcloud cli](https://cloud.google.com/sdk/docs/#install_the_latest_cloud_tools_version_cloudsdk_current_version)
   - `gcloud components install beta`
 - setup Google cloud project
 - choose a [zone and region](https://cloud.google.com/compute/docs/regions-zones/#available) to install your Gitpod cluster
 - [Enable APIs](https://cloud.google.com/endpoints/docs/openapi/enable-api#enabling_an_api):
   - Identity and Access Management (IAM)
   - Cloud SQL Admin API

```
gcloud auth login
gcloud config set core/project <gcloud-project>
gcloud config set compute/region <gcloud-region>
gcloud config set compute/zone <gcloud-zone>

PROJECT_ID=<gcloud-project-id>
REGION=<gcloud-region>
```

### IP

```
gcloud compute addresses create gitpod-inbound-ip --region=$REGION
IP_ADDRESS=$(gcloud compute addresses describe gitpod-inbound-ip --region $REGION | grep "address:" | cut -d' ' -f2)
```


Now that you have a reserved IP address, you will have to set up the following DNS A records resolving to that IP address:
  - `your-base-domain`
  - `*.your-base-domain`
  - `*.ws.your-base-domain`


### VPC Network

```
gcloud compute networks create gitpod-vpc --bgp-routing-mode=regional --subnet-mode=auto
```


### Cluster

```
gcloud iam service-accounts create gitpod-nodes-meta
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-meta@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/clouddebugger.agent
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-meta@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/cloudtrace.agent
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-meta@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/errorreporting.writer
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-meta@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/logging.viewer
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-meta@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/logging.logWriter
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-meta@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/monitoring.metricWriter
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-meta@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/monitoring.viewer

gcloud iam service-accounts create gitpod-nodes-workspace
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-workspace@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/clouddebugger.agent
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-workspace@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/cloudtrace.agent
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-workspace@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/errorreporting.writer
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-workspace@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/logging.viewer
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-workspace@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/logging.logWriter
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-workspace@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/monitoring.metricWriter
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-nodes-workspace@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/monitoring.viewer
```

Choose one (or more) zones to install your cluster to
```
ZONES=us-west1-a,us-west1-b
gcloud beta container clusters create gitpod-cluster \
        --region=$REGION    \
        --node-locations=$ZONES \
        --cluster-version="1.13.7-gke.24" \
        --addons=NetworkPolicy  \
        \
        --no-enable-basic-auth \
        --no-issue-client-certificate \
        \
        --enable-ip-alias \
        --cluster-ipv4-cidr="10.8.0.0/14" \
        --services-ipv4-cidr="10.0.0.0/20" \
        --network=gitpod-vpc \
        \
        --enable-network-policy \
        --enable-pod-security-policy \
        \
        --metadata disable-legacy-endpoints=true \
        --num-nodes=1 \
        --enable-autoscaling --min-nodes=1 --max-nodes=3 \
        --service-account=gitpod-nodes-meta@$PROJECT_ID.iam.gserviceaccount.com \
        --node-labels="gitpod.io/workload_meta=true" \
        --machine-type=n1-standard-4 \
        --image-type=cos \
        --disk-size=100 \
        --disk-type=pd-ssd \
        --enable-autorepair \
        --local-ssd-count=0 \
        --workload-metadata-from-node=SECURE

gcloud beta container node-pools create workspace-pool-1 \
        --region=$REGION    \
        --cluster=gitpod-cluster \
        \
        --metadata disable-legacy-endpoints=true \
        --num-nodes=0 \
        --enable-autoscaling --min-nodes=0 --max-nodes=10 \
        --service-account=gitpod-nodes-workspace@$PROJECT_ID.iam.gserviceaccount.com \
        --node-labels="gitpod.io/workload_workspace=true" \
        --machine-type=n1-standard-16 \
        --image-type=ubuntu \
        --disk-size=200 \
        --disk-type=pd-ssd \
        --enable-autorepair \
        --local-ssd-count=1
```

## Optional

### GCP Managed DB

```
DB_PW=$(openssl rand -base64 20)
DB_NAME=gitpod-db
BACKUP_TIME="04:00"
gcloud sql instances create $DB_NAME \
    --database-version MYSQL_5_7 \
    --storage-size=100 \
    --storage-auto-increase \
    --tier=db-n1-standard-4 \
    --region=$REGION \
    --backup-start-time=$BACKUP_TIME \
    --failover-replica-name=$DB_NAME-failover \
    --replica-type=FAILOVER \
    --enable-bin-log

gcloud sql users set-password root --host % --instance $DB_NAME --password $DB_PW
echo "Database root password: $DB_PW"
```
Note: Store password securely for later use!

```
gcloud iam service-accounts create gitpod-cloudsql-client
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-cloudsql-client@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/cloudsql.client
gcloud iam service-accounts keys create gitpod-cloudsql-client-key.json --iam-account=gitpod-cloudsql-client@$PROJECT_ID.iam.gserviceaccount.com
```


#### Initialize DB

 1. [Get `cloud_sql_proxy` binary](https://cloud.google.com/sql/docs/mysql/sql-proxy#install)
    ```
    wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
    chmod +x cloud_sql_proxy
    ```

 2. Connect to DB
    ```
    ./cloud_sql_proxy -instances=$PROJECT_ID:$REGION:$DB_NAME=tcp:0.0.0.0:3306 -credential_file=./gitpod-cloudsql-client-key.json
    ```

    2nd terminal: login with root password
    ```
    mysql -u root -P 3306 -h 127.0.0.1 -p
    ```

 3. Execute init scripts
    Generate password for gitpod user:
    ```
    GITPOD_DB_PW=$(openssl rand -base64 20)
    ```

    ```
    set @gitpodDbPassword = <GITPOD_DB_PW>;

    source config/db/init/00-create-user.sql
    source config/db/init/01-recreate-gitpod-db.sql
    source config/db/init/02-create-and-init-sessions-db.sql
    ```


### GCP Buckets for workspace backups

```
gcloud iam service-accounts create gitpod-workspace-syncer
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-workspace-syncer@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/storage.admin
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-workspace-syncer@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/storage.objectAdmin
gcloud iam service-accounts keys create gitpod-workspace-syncer-key.json --iam-account=gitpod-workspace-syncer@$PROJECT_ID.iam.gserviceaccount.com
```


### GCP Registry

Push and Pull access to the registry
```
gcloud iam service-accounts create gitpod-registry-full
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-registry-full@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/storage.admin
gcloud iam service-accounts keys create gitpod-registry-full-key.json --iam-account=gitpod-registry-full@$PROJECT_ID.iam.gserviceaccount.com
```

## Install

cluster init:
```
kubectl create -f tiller-sa.yaml
helm init --service-account tiller
```

install gitpod:
```
cd gitpod
helm dependencies update
helm install -f values.yaml [[-f <optional-values.yaml>]...] --name gitpod .
```
