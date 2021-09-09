## How to try locally

Prerequisite: make sure you have buildkit in the path
```bash
cd /tmp
curl -OL https://github.com/moby/buildkit/releases/download/v0.9.0/buildkit-v0.9.0.linux-amd64.tar.gz
tar xzfv buildkit-v0.9.0.linux-amd64.tar.gz
sudo mv bin/* /usr/bin
```

Set things up
```bash
# run a local registry
docker run --rm -d -p 5000:5000 registry:latest

# produce a test image
mkdir -p /tmp/f
cd /tmp/f
echo <<EOF > Dockerfile
FROM alpine:latest
ENV foo=bar
EOF
docker build -t localhost:5000/source:latest .
docker push localhost:5000/source:latest
```

Build and run
```
# build and install bob (do this after every change)
cd /workspace/gitpod/components/image-builder-bob
go install

# run bob
BOB_BASE_REF=localhost:5000/source:latest BOB_TARGET_REF=localhost:5000/target:83 sudo -E $(which bob) build

# debug using delve
BOB_BASE_REF=localhost:5000/source:latest BOB_TARGET_REF=localhost:5000/target:83 sudo -E $(which dlv) --listen=:2345 --headless=true --api-version=2 exec $(which bob) build
```