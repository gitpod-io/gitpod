module "storage" {
  source = "./modules/storage"
  region = var.region
  bucket_name = var.bucket_name
  providers = {
    kubernetes = kubernetes
    helm = helm
  }
}