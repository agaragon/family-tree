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
  default     = "ft"
}

