
# ElasticSearch

We're running a bit of an unsual ElasticSearch setup: we have just one node. This means we must set the replicas per index to zero so that the shards are assigned to our single node. This setting is stored in the PV.

## How do I find out if this is the issue?
Exec into the elasticsearch container and run `curl localhost:9200/_cluster/health/?pretty=true`.
If there unassigned shards, this might be the issue.

## How do I fix it?
Run the following:
```
cat <<EOF | kubectl exec -i --namespace monitoring elasticsearch-master-0 -- bash
curl -XPUT -H "Content-Type: application/json" 'http://localhost:9200/_all/_settings' -d '{"index.number_of_replicas" : "0"}'
curl -XPUT -H "Content-Type: application/json" 'http://localhost:9200/_template/all' -d '{"template": "*", "settings": { "number_of_replicas": 0 }}'
EOF
```

