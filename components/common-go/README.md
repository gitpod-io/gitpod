# How to upgrade Kubernetes dependencies

General steps:
 1. modify target versions in `go-update-wc-deps.sh`
 1. run `./go-update-wc-deps.sh`
   1. if it fails, fix the test/code, and run it again until all tests are good - except `install/installer`
 1. take care of `install/installer`
   1. manually verify that the `go.mod` has the target versions set, and if not, adjust manually (not sure why these get overriden there)
   1. make sure `helm.sh/helm/v3` is set to a compatible version (refer to https://github.com/helm/helm/releases/ to see which release bumps "k8s-io" to which version)
   1. test with `go mod tidy && go test ./...` until it succeeds


gpl: I just noticed that probably `go-get-kubernetes.sh` was meant for bumping kubernetes versions in `common-go` - which I did manually. So probably that should be the very first step.
