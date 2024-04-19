## JetBrains Intergration Test

See also [Internal Document](https://www.notion.so/gitpod/IDE-Integration-Tests-350235cc0db7489e86ebb57488a91f78)

### How to trigger it manually?

#### 1. With GHA

- Trigger https://github.com/gitpod-io/gitpod/actions/workflows/ide-integration-tests.yml

#### 2. In workspace with GHA

- Create a preview env
```sh
TF_VAR_infra_provider="gce"
TF_VAR_with_large_vm=true leeway run dev:preview
```
- Start tests
```sh
cd test/tests/ide/jetbrains
go test -v ./... -kubeconfig=/home/gitpod/.kube/config -namespace=default -username=<your_user_name>
```

#### 3. In workspace

- Create a preview env
```sh
TF_VAR_infra_provider="gce"
TF_VAR_with_large_vm=true leeway run dev:preview
```
- Install GUI dependencies
```sh
sudo apt-get update
sudo apt-get install -y libxkbfile-dev pkg-config libsecret-1-dev libxss1 dbus xvfb libgtk-3-0 libgbm1
wget https://raw.githubusercontent.com/gitpod-io/openvscode-server/main/build/azure-pipelines/linux/xvfb.init
sudo mv ./xvfb.init /etc/init.d/xvfb
sudo chmod +x /etc/init.d/xvfb
sudo update-rc.d xvfb defaults
sudo service xvfb start
```
- Create A PAT token
- Start tests
```sh
cd test/tests/ide/jetbrains
export TEST_IN_WORKSPACE=true
export ROBOQUAT_TOKEN=skip
 export USER_TOKEN=<your_pat_token>
go test -v ./... -kubeconfig=/home/gitpod/.kube/config -namespace=default -username=<your_user_name>
```

> If you want to specify an editor, you could append a special run case to go test command. i.e. `-run ^TestIntellij`
