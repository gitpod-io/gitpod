# db-sync-test

A tool to test the `db-sync` issue described in [Notion](https://www.notion.so/gitpod/db-sync-data-consistencies-investigation-3393541c4cc94808b96ade68b22d506c) locally.

## Usage

Run `./start.sh`.

This will:
* Start a `mysql` server in a container.
* Create two databases.
* Run the Go program in this directory to create a table in each directory.
* Start `db-sync`, configured to sync the tables created in the previous step.
* Tail the `db-sync` logs.

At this point `go run . --database foo -n 10000` can be run manually to bulk insert data into either database.
