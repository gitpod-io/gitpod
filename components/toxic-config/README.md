# toxic-config

Configures a given [Toxiproxy](https://github.com/Shopify/toxiproxy) proxy with a latency toxic.

For example, with a Toxiproxy instance running on `localhost:8474` with a proxy called `mysql` configured:

```
go run . --proxy mysql --latency=1000 --jitter=250
```

will configure the `mysql` proxy with a [latency toxic](https://github.com/Shopify/toxiproxy#latency) with `latency` and `jitter` set to the provided values.

`toxic-config` is intended to run as a sidecar container in a Kubernetes pod alongside the Toxiproxy instance to be configured.
