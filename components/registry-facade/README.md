# Introduction to registry-facade

The container runtime consumes `registry-facade`.

Registry-facade modifies images as they are downloaded. It consults with `ws-manager` and adds layers in a certain order:

1. The base image for the workspace
2. supervisor
3. workspacekit
4. A DockerUp image
5. IDE
6. Desktop IDE

It also adds the `gp` cli to the workspace. Think of `registry-facade` as an image layer smuggler.
