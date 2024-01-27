# IDE Metrics

Handy, cheaper and easier way to help collect `error report` and `metrics` for ide components (i.e. supervisor vscode-desktop-extension vscode-web-workbench)

## How to Debug

### From source in Gitpod Browser Code

**start simple server**

```sh
go run main.go run --config config-example.json --verbose
```

**with breakpoints**

- Start a dlv server
```sh
dlv debug --listen=127.0.0.1:32991 --headless --api-version=2 -- run main.go run --config config-example.json --verbose
```
- Run `Attack to Delve (gitpod)` in `Run and Debug` panel

### Hot deploy to preview env

```
./debug.sh
```
