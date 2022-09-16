# db-sync

This component runs only in Gitpod SaaS and is responsible for bidirectional synchronisation of data between two or more mysql databases.

### Commands

`db-sync` has two subcommands: `db-sync run` and `db-sync export` .

- `db-sync run`: Runs the sync process repeatedly
- `db-sync export`: Exports a SQL file containing the sync operations

### Config

`db-sync` uses a config file (passed as the `--config` argument to `db-sync run`). There is an [example config](https://github.com/gitpod-io/gitpod/blob/main/components/ee/db-sync/example-config.json) in the repository and a production config file looks like this:

```yaml
{
  "disableTransactions": false,
  "replicationLogDir": "/var/log/db-sync",
  "roundRobin": true,
  "syncPeriod": 10000,
  "tableSet": "gitpod",
  "targets": [
    {
      "database": "gitpod",
      "host": "localhost",
      "name": "...",
      "password": "...",
      "port": 3300,
      "user": "gitpod"
    },
    {
      "database": "gitpod",
      "host": "localhost",
      "name": "...",
      "password": "...",
      "port": 3301,
      "user": "gitpod"
    }
  ]
}
```

### Modes

`db-sync` runs in “round robin mode” in production (`”roundRobin”: true` in the above config).

Round robin mode:
  - Connects to each target database in the config and creates a “replicator” for each.
  - Calls `synchronize` on each replicator in turn, to sync each database with every other one.
  - The synchronisation loop (running each replicator) happens every `syncPeriod` milliseconds (so every 10s in the above config).

`db-sync` attempts a graceful shutdown by handing `SIGINT` and waiting for any currently running sync to complete before terminating. In Kubernetes this should mean that when `db-sync` is terminated it has 30 seconds (the default termination grace period) in which to complete synchronisation before being forcibly terminated with a `SIGTERM`.

### Synchronisation

- The list of tables that `db-sync` considers for synchronisation is defined by the `GitpodTableDescriptionProvider` in [tables.ts](https://github.com/gitpod-io/gitpod/blob/243ee21379f90f3c70f79f0317723006270493bf/components/gitpod-db/src/tables.ts#L47-L309).
- Each table to be synchronised must specify a `timeColumn` of type `timestamp`
- Tables can specify some columns as ignored by `db-sync` (via `[ignoreColumns](https://github.com/gitpod-io/gitpod/blob/243ee21379f90f3c70f79f0317723006270493bf/components/gitpod-db/src/tables.ts#L21)`)

All rows in considered tables with a `timeColumn` later than the start time of the current sync are inserted into the target database(s).

If a table specifies a `deletionColumn` all rows marked as deleted in the source are hard-deleted from the target database(s) *as well as the source database*.

### gitpod_replication table

`db-sync` uses the `gitpod_replication` db table. This table holds a single row, continuously updated, containing the last time `db-sync` performed a sync. This timestamp is used as the start_date for the next sync. This start_date can also be ignored to force a full sync.

### Logging

`db-sync` writes logs to `config.replicationLogDir` where each timestamped logged file contains the SQL run on each database during that synchronisation.
