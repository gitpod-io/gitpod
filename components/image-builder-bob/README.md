## How to try locally

Prerequisite: make sure you have buildkit in the path
```bash
cd /tmp
curl -OL https://github.com/moby/buildkit/releases/download/v0.10.0/buildkit-v0.10.0.linux-amd64.tar.gz
tar xzfv buildkit-v0.10.0.linux-amd64.tar.gz
sudo mv bin/* /usr/bin
```

Set things up
```bash
# install oci-tool for inspecting the built image
go install github.com/csweichel/oci-tool@latest

# run a local registry
docker run --rm -d -p 5000:5000 registry:latest

# produce a test image
mkdir -p /tmp/f
cd /tmp/f
cat <<EOF > Dockerfile
FROM alpine:latest
ENV foo=bar
EOF
docker build -t localhost:5000/source:latest .
docker push localhost:5000/source:latest
```

Build and Debug Locally

```
# create a file using the contents of Google artifact registry https://www.notion.so/gitpod/Bob-proxy-env-vars-a8c3feb32092410296b7e913746fed45

touch /workspace/gitpod/components/image-builder-bob/bob.env

# Start bob proxy in debug mode using vs code `bob proxy`
# Use CMD+SHIFT+D to open menu and then select bob proxy and then run

# Add break points as per your needs

# export bob.env variables so that bob build uses correct values while trying to build an image

set -a
source <(cat bob.env | \
    sed -e '/^#/d;/^\s*$/d' -e "s/'/'\\\''/g" -e "s/=\(.*\)/='\1'/g")
set +a


# Run bob build. This will trigger several calls to the container registry
sudo -E $(which bob) build
```
