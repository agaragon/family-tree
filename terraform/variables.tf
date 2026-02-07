variable "aws_region" {
  description = "AWS region for S3 and other resources"
  type        = string
  default     = "us-east-1"
}

variable "domain" {
  description = "Root domain you own (e.g. programmingwitharagon.com)"
  type        = string
  default     = "programmingwitharagon.com"
}

variable "subdomain" {
  description = "Subdomain for the site (full hostname will be subdomain.domain)"
  type        = string
  default     = "family-tree"
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for the domain (required for DNS and SSL validation)"
  type        = string
}
