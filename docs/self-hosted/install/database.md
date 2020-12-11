---
url: /docs/self-hosted/latest/install/database/
---


#####TODO
#### Database
Gitpod uses a MySQL database to store user data. By default Gitpod ships with a MySQL database built-in. If you operate your own MySQL database (which we'd recommend in a production setting) you can use that one. You have the following options:

* Integrated database: If not disabled, this MySQL database is installed in a Kubernetes pod as a part of Gitpod’s Helm chart.
The database uses a Kubernetes PersistentVolume. We do not recommend using this option fo a production setting.

* Own MySQL database: Gitpod requires MySQL in version 5.7 or newer.

This chart installs a MySQL database which gets Gitpod up and running but is not suitable for production (the data is lost on each restart of the DB pod). To connect to a proper MySQL installation:
   - initialize your MySQL database using the SQL files in `database/`. E.g. in a mysql session connected to your database server run:
     ```
     SET @gitpodDbPassword = IFNULL(@gitpodDbPassword, 'your-password-goes-here');
     source database/01-create-user.sql;
     source database/02-create-and-init-sessions-db.sql;
     source database/03-recreate-gitpod-db.sql;
     ```
   - `echo values/database.yaml >> configuration.txt`
   - in `values/database.yaml` change the values in `gitpod.db` to match your installation
