#! /bin/bash

MYSQL_ROOT_PASSWORD="password"
MYSQL_TAG="5.7"

SYNC_PERIOD=500
FIRST_DB_NAME="foo"
SECOND_DB_NAME="bar"
LOG_DIR="./log"

printf "Starting mysql container...\n"
docker stop some-mysql > /dev/null 2>&1
docker run --rm --name some-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD -d mysql:$MYSQL_TAG

printf "Waiting 15s for mysqld..."
sleep 15

printf "Creating databases...\n"
mysql -h 127.0.0.1 -u root -p$MYSQL_ROOT_PASSWORD <<EOF
CREATE DATABASE $FIRST_DB_NAME;
CREATE DATABASE $SECOND_DB_NAME;
EOF

printf "Creating databases tables...\n"
go run . --database "$FIRST_DB_NAME"
go run . --database "$SECOND_DB_NAME"

printf "Writing db-sync config file...\n"
pushd /workspace/gitpod/components/ee/db-sync || exit
cat <<EOF > config.json
{
    "syncPeriod": $SYNC_PERIOD,
    "roundRobin": true,
    "tableSet": "test",
    "disableTransactions": false,
    "replicationLogDir": "$LOG_DIR",
    "targets": [
        {
            "host": "localhost",
            "port": 3306,
            "database": "$FIRST_DB_NAME",
            "user": "root",
            "password": "$MYSQL_ROOT_PASSWORD"
        },
        {
            "host": "localhost",
            "port": 3306,
            "database": "$SECOND_DB_NAME",
            "user": "root",
            "password": "$MYSQL_ROOT_PASSWORD"
        }
    ]
}
EOF

printf "Starting db-sync...\n"
rm -rf $LOG_DIR
mkdir $LOG_DIR
yarn start run --config config.json
popd || exit
