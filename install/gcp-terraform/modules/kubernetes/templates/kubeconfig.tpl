apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${certificate_authority_data}
    server: https://${server}
  name: ${name}-cluster
contexts:
- context:
    cluster: ${name}-cluster
    namespace: ${namespace}
    user: ${name}-user
  name: ${name}
current-context: ${name}
kind: Config
preferences: {}
users:
- name: ${name}-user
  user:
    username: ${username}
    password: ${password}
