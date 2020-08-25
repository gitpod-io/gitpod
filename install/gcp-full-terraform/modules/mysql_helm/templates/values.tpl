#
# Terraform Module: mysql_helm
#

db:
  host: "${host}"
  password: "${password}"


components:
  db:
    gcloudSqlProxy:
      enabled: false
  
mysql:
  enabled: false
