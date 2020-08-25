locals {
  database = {
    host     = aws_db_instance.gitpod.address
    port     = aws_db_instance.gitpod.port
    username = aws_db_instance.gitpod.username
    password = aws_db_instance.gitpod.password
  }
}
