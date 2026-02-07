output "url" {
  description = "Site URL"
  value       = "https://${local.fqdn}"
}

output "s3_bucket" {
  description = "S3 bucket name (sync your build output here)"
  value       = aws_s3_bucket.web.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation)"
  value       = aws_cloudfront_distribution.web.id
}
