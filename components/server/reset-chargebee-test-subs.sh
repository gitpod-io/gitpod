#!/bin/bash

if [ -z "$USER_ID" ]; then
    echo "USER_ID must be set!";
    exit 1;
fi


DB_USERNAME=$(kubectl get secrets mysql -o jsonpath="{.data.username}" | base64 -d)
DB_PASSWORD=$(kubectl get secrets mysql -o jsonpath="{.data.password}" | base64 -d)

# Make sure there are no existing port-forwards blocking us
pkill -f "kubectl port-forward (.*) 33306:3306"

kubectl port-forward statefulset/mysql 33306:3306 &

sleep 2;

mysql -u "$DB_USERNAME" -h 127.0.0.1 -P 33306 -p"$DB_PASSWORD" gitpod -e "DELETE FROM d_b_team_subscription; DELETE FROM d_b_subscription; DELETE FROM d_b_team; DELETE FROM d_b_team_membership; DELETE FROM d_b_team_subscription2;";

# Team Subscription (owner does not necessarily have to have a seat!)
mysql -u "$DB_USERNAME" -h 127.0.0.1 -P 33306 -p"$DB_PASSWORD" gitpod -e "INSERT INTO d_b_team_subscription (id,userId,paymentReference,startDate,endDate,planId,quantity,cancellationDate,deleted,excludeFromMoreResources) VALUES ('00000000-0000-0000-0000-111111111111','$USER_ID','fake-personal-payment-ref','2021-02-09T10:13:02.000Z','','team-professional-new-eur',1,'',0,0);";

# Personal Subscription
mysql -u "$DB_USERNAME" -h 127.0.0.1 -P 33306 -p"$DB_PASSWORD" gitpod -e "INSERT INTO d_b_subscription (userId,startDate,amount,uid,planId,paymentReference,deleted,cancellationDate,paymentData,teamSubscriptionSlotId) VALUES ('$USER_ID','2021-02-09T10:13:02.000Z',11904.0,'00000000-0000-0000-0000-222222222222','professional-eur','fake-ts-payment-ref',0,'',NULL,'');";

# Team Subscription (aka Team/Org. Billing with Chargebee plan)
mysql -u "$DB_USERNAME" -h 127.0.0.1 -P 33306 -p"$DB_PASSWORD" gitpod -e "INSERT INTO d_b_team (id, name, slug, creationTime, deleted, _lastModified, markedDeleted) VALUES ('00000000-0000-0000-0000-333333333333', 'team1', 'team1', '2022-10-06T21:25:00.562Z', '0', '2022-10-06 21:25:00.565828', '0')";
mysql -u "$DB_USERNAME" -h 127.0.0.1 -P 33306 -p"$DB_PASSWORD" gitpod -e "INSERT INTO d_b_team_membership (id, teamId, userId, role, creationTime, deleted, _lastModified, subscriptionId) VALUES ('00000000-0000-0000-0000-444444444444', '00000000-0000-0000-0000-333333333333', '$USER_ID', 'owner', '2022-10-06T21:25:00.562Z', '0', '2022-10-07 10:57:32.992862', 'b33ad778-2f12-429a-9f35-9aa5e275df3d')";
mysql -u "$DB_USERNAME" -h 127.0.0.1 -P 33306 -p"$DB_PASSWORD" gitpod -e "INSERT INTO d_b_team_subscription2 (id, teamId, paymentReference, startDate, endDate, planId, quantity, cancellationDate, deleted, _lastModified, excludeFromMoreResources) VALUES ('00000000-0000-0000-0000-555555555555', '00000000-0000-0000-0000-333333333333', 'fake-ts2-payment-ref', '2022-10-07T10:57:23.000Z', '', 'team-professional-eur', '1', '', '0', '2022-10-07 10:57:32.946359', '1')";
