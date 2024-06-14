# one time setup

## download k3d
```bash
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
```

## create cluster

```bash
k3d cluster create -c ./local-preview/k3d.yaml
```

## install prereqs

```bash
TF_VAR_preview_name=local leeway run dev/preview:create-preview
cd ./local-preview/
./setup.sh
```


# for dev loop

run `kubectl port-forward svc/proxy 8443:443` in your terminal

```bash
cd ./local-preview/
./update.sh
```


# mac local portforward setup

```bash
echo "rdr pass on lo0 inet proto tcp from any to self port 443 -> 127.0.0.1 port 8443" | sudo tee /etc/pf.anchors/gitpod

sudo vi /etc/pf.conf

## manual add something
# add `rdr-anchor "gitpod"` below `rdr-anchor "com.apple/*"`
# add `load anchor "gitpod" from "/etc/pf.anchors/gitpod"` below `load anchor "com.apple" from "/etc/pf.anchors/com.apple"`

# config should looks like
#
# ....
# rdr-anchor "com.apple/*"
# rdr-anchor "gitpod"
# ...
# load anchor "com.apple" from "/etc/pf.anchors/com.apple"
# load anchor "gitpod" from "/etc/pf.anchors/gitpod"

# apply changes
sudo pfctl -ef /etc/pf.conf
```


you can view preview env at https://local.preview.gitpod-dev.com
