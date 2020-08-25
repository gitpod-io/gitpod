components:
  imageBuilder:
    registryCerts: []
    registry:
      name: "${host}"
      secretName: ${secret_name}

  workspace:
    pullSecret:
      secretName: ${secret_name}

docker-registry:
  enabled: false

gitpod_selfhosted:
  variants:
    customRegistry: true