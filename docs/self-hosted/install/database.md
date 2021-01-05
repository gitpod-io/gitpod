---
url: /docs/self-hosted/latest/install/database/
---

# Database
Gitpod uses a MySQL database to store user data. By default Gitpod ships with a MySQL database built-in. If you operate your own MySQL database (which we'd recommend in a production setting) you can use that one. You have the following options:

* Integrated database: If not disabled, this MySQL database is installed in a Kubernetes pod as a part of Gitpod’s Helm chart.
The database uses a Kubernetes PersistentVolume. We do not recommend using this option fo a production setting.

* Own MySQL database: Gitpod requires MySQL in version 5.7 or newer.

This chart installs a MySQL database which gets Gitpod up and running but is not suitable for production (the data is lost on each restart of the DB pod). To connect to a proper MySQL installation:
 1. Initialize your MySQL database using the SQL files in `config/db/init/`. E.g. in a mysql session connected to your database server run:
```
SET @gitpodDbPassword = IFNULL(@gitpodDbPassword, 'your-password-goes-here');
source config/db/init/00-testdb-user.sql;
source config/db/init/01-create-user.sql;
source config/db/init/02-create-and-init-sessions-db.sql;
source config/db/init/03-recreate-gitpod-db.sql;
```
 2. Create a file `values.db.yaml` with the following content:
```yaml
db:
  host: db
  port: 3306
  password: your-password-goes-here

# Disable built-in MySQL instance
mysql:
  enabled: false
```
 3. Do a `helm upgrade --install -f values.db.yaml gitpod .` to apply the changes.
