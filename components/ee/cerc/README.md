# Cerc

Cerc (circle in Romanian) monitors services by calling an HTTP endpoint with a token expecting to receive that token back within a certain amount of time.
Compared to regularly polling some health probe HTTP endpoint this method allows going full-circle: trigger some action which is answered by the some token.

## Quickstart

```shell
$ cerc <config.json>
```

Cercs default config contains three pathways:
- `selftest-positive` which runs against itself and should always succeed. This pathway is self-triggered every 10 seconds. You should see corresponding log output.
- `selftest-fails` which runs against itself but is designed to fail. This pathway is externally triggered, e.g. using `curl localhost:8080/trigger/selftest-fails`.
- `selftest-resp-timeout` runs against cerc itself so that cerc can answer too late. This pathway is externally triggered, e.g. using `curl localhost:8080/trigger/selftest-resp-timeout`.

## Configuration
cerc is configured using a single JSON config file. See `examples/selftest.json` for an example.

## How to respond to a cerc request?
cerc sends two headers when making a request to an endpoint:
- `X-Cerc-ResponseURL` contains the URL to which cerc exepects a POST request as answer to its request,
- `X-Cerc-Token` is the Bearer token one needs to send with the answer request, i.e. `Authorization: Bearer <token>`.
