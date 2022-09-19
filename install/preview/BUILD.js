const packages = []

const withLocalPreview = args.withLocalPreview == "true"

if (withLocalPreview) {
    const docker = {
        "name": "docker",
        "type": "docker",
        "deps": [
          "install/installer:app",
          "install/preview/prettylog:app"
        ],
        "argdeps": [
            "imageRepoBase"
        ],
        "srcs": [
            "entrypoint.sh",
            "manifests/*.yaml"
        ],
        "config": {
          "dockerfile": "leeway.Dockerfile",
          "image": [`${args.imageRepoBase}/local-preview:${args.version}`]
        }
    }
    packages.push(docker)
} else {
  packages.push({
    "name": "docker",
    "type": "generic",
    "config": {
      "commands": [
        ["echo", "Skipping build of install/preview:docker as -DwithLocalPreview was not set to true"]
      ]
    }
  })
}
