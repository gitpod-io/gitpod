resource "random_password" "password" {
  count = var.enable_external_database ? 1 : 0

  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_db_subnet_group" "gitpod_subnets" {
  count = var.enable_external_database ? 1 : 0

  name       = "db-sg-${var.cluster_name}"
  subnet_ids = [module.vpc.public_subnets[2], module.vpc.public_subnets[3]]
}

resource "aws_security_group" "rdssg" {
  count = var.enable_external_database ? 1 : 0

  name   = "dh-sg-${var.cluster_name}"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port   = 0
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "gitpod" {
  count = var.enable_external_database ? 1 : 0

  allocated_storage      = 10
  max_allocated_storage  = 100
  engine                 = "mysql"
  engine_version         = "5.7"
  instance_class         = "db.t3.micro"
  vpc_security_group_ids = [aws_security_group.rdssg[0].id]
  identifier             = "db-${var.cluster_name}"
  name                   = "gitpod"
  username               = "gitpod"
  password               = random_password.password[0].result
  parameter_group_name   = "default.mysql5.7"
  db_subnet_group_name   = aws_db_subnet_group.gitpod_subnets[0].name
  skip_final_snapshot    = true
  publicly_accessible    = true
}
