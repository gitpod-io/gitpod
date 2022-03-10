# Installing Gitpod in an air-gap network with the Gitpod Installer

## Mirror Gitpod Images

You need a registry that is reachable in your network. Add the domain of your registry to the Gitpod config `gitpod.config.yaml` like this:
```yaml
repository: your-registry.example.com
```

The command `gitpod-installer mirror list` gives you a list of all images needed by Gitpod. You can run the following code to pull the needed images and push them to your registry:

```
for row in $(gitpod-installer mirror list --config gitpod.config.yaml | jq -c '.[]'); do
    original=$(echo $row | jq -r '.original')
    target=$(echo $row | jq -r '.target')

    docker pull $original
    docker tag $original $target
    docker push $target
done
```

## Install Gitpod in Air-Gap Mode

To install Gitpod in an air-gap network, you need to configure the repository of the images needed by Gitpod (see previous step) and disable the `definitely-gp` feature. Add this to your Gitpod config:

```yaml
repository: your-registry.example.com
disableDefinitelyGp: true
```

That's it. Run the following commands as usual and Gitpod fetches the images from your registry and does not need internet access to operate:

```
gitpod-installer render --config gitpod.config.yaml > gitpod.yaml
kubectl apply -f gitpod.yaml
```
