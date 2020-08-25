#
# Terraform Module: mysql_gcp
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
