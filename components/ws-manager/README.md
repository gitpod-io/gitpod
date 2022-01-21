# Introduction to ws-manager

The workspace manager (aka `wsman`) controls workspaces and reports their state. It serves as our facade towards Kubernetes.

## Design Principles

1. Kubernetes is the state. We only modify that state and transform it. Only when there is no way to store something in Kubernetes, do we venture out and maintain our own.
2. Minimalism. The workspace manager creates, starts, reports on, and stops workspace pods and services. There are only workspaces.

## Development

Helpful alias: `alias wsman="go run main.go"`

### Starting ws-manager locally

You can start `ws-manager` in any Kubernetes cluster, it will only look at pods that bear its label. This means `ws-manager` will not interfere with the old `ws-monitor` or the like.
To run `ws-manager` you need:

1. _messagebus you can connect to:_ e.g. `kubectl port-forward deployment/messagebus 5672`
2. _valid configuration file:_ e.g. `example-config.json`. You can use `wsman validate-config --config example-config.json` to make sure you have a valid configuration file.
3. _Kubernetes cluster to work with:_ you can use your `kubectl` config file using the `--kubeconfig` flag or otherwise have it connect to the cluster it's running in

Then run `wsman run --config example-config.json --kubeconfig ~/.kube/config -v`

### Making changes to the protocol

Protocol changes are to be made in ws-manager-api component.

### Interacting with ws-manager

There's a handy CLI that can be used to interact with a `ws-manager` instance: `wsman client`.
Use the `-H` flag to connect to either the HTTP RPC interace (`http://localhost:8080/rpc` in case of `example-config.json`).

### Running tests

We use the standard Go `testing` package to run tests. To execute all `ws-manager` tests run `go test -v ./...`.
Some of our test-cases use _golden_ files. If you want to update one, delete that particular file and execute the tests with `-update`.

Go has a load of handy flags for its testing abilities. For example the built-in race detector using `go test -race -v ./...`.

### Event trace log/Adding manager status tests

The `example-config.json` enables something called the _event trace log_. This log found in `/tmp/evts.json` is a newline delimited JSON file which contains the objects we got from Kubernetes, as well as what we make of it.
This EVT can be converted to testcases using `cd pkg/manager && go run testdata/evtsToTestdata.go -evts /tmp/evts.json -prefix myNewTestcase`.

### Adding tests for Create Definite Workspace Pod

To create new testcases for the workspace pod creation part, one can convert a workspace request to a "start workspace context" required as input for such a test.
To do this, save a valid _workspace spec_ (e.g. `example-wsspec.json`) file as `pkg/manager/testdata/cdwp_MyCustomTestName.spec.json` and run the tests. The `TestCreateDefiniteWorkspacePod` test will convert those `cdwp_*.spec.json` files to the required test fixtures as `cdwp_*.json`.
