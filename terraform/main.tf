provider "aws" {
  region = var.aws_region
}

# S3 bucket in us-east-1 to avoid 301 when bucket was created there; CloudFront works with any region
provider "aws" {
  alias  = "s3"
  region = "us-east-1"
}

# ACM for CloudFront must be in us-east-1
provider "aws" {
  alias  = "acm"
  region = "us-east-1"
}

locals {
  fqdn         = "${var.subdomain}.${var.domain}"
  s3_origin_id = "s3-${local.fqdn}"
  # Bucket name: FQDN with only the last dot (before TLD) replaced by hyphen, e.g. ft.programmingwitharagon.com
  tld          = element(split(".", var.domain), length(split(".", var.domain)) - 1)
  bucket_name  = replace(local.fqdn, ".${local.tld}", "-${local.tld}")
}

# Look up Route53 hosted zone by domain (no manual zone ID needed)
data "aws_route53_zone" "main" {
  name         = "${var.domain}."
  private_zone = false
}

# S3 bucket for static site (us-east-1 to match regional endpoint)
resource "aws_s3_bucket" "web" {
  provider = aws.s3
  bucket   = local.bucket_name
}

resource "aws_s3_bucket_public_access_block" "web" {
  provider = aws.s3
  bucket   = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets  = true
}

# CloudFront OAC so distribution can read from private S3
resource "aws_cloudfront_origin_access_control" "web" {
  name                              = local.fqdn
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Allow only CloudFront to read from S3 (policy applied after CloudFront exists)
resource "aws_s3_bucket_policy" "web" {
  provider   = aws.s3
  bucket     = aws_s3_bucket.web.id
  depends_on = [aws_s3_bucket_public_access_block.web, aws_cloudfront_distribution.web]
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFront"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.web.arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.web.arn } }
    }]
  })
}

# SSL certificate (CloudFront requires us-east-1)
resource "aws_acm_certificate" "web" {
  provider          = aws.acm
  domain_name       = local.fqdn
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = local.fqdn
  aliases             = [local.fqdn]

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods        = ["GET", "HEAD"]
    target_origin_id      = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    compress              = true
    min_ttl               = 0
    default_ttl           = 3600
    max_ttl               = 86400
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.web.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  depends_on = [aws_acm_certificate_validation.web]
}

# DNS validation for ACM (required for cert to be issued)
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.web.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  zone_id = data.aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "web" {
  provider                = aws.acm
  certificate_arn         = aws_acm_certificate.web.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# Route53 alias to CloudFront
resource "aws_route53_record" "web" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.fqdn
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "web_aaaa" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.fqdn
  type    = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}
