authProviders:
%{ for auth_provider in jsondecode(auth_providers) ~}
- id: "${auth_provider.id}"
  host: "${auth_provider.host}"
  type: "${auth_provider.type}"
  protocol: https
  oauth:
    clientId: "${auth_provider.client_id}"
    clientSecret: "${auth_provider.client_secret}"
    callBackUrl: "${auth_provider.callback_url}"
    settingsUrl: "${auth_provider.settings_url}"
  description: ""
  icon: ""
%{ endfor ~}