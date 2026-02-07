#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Default deploy target: ft.programmingwitharagon.com (matches terraform/variables.tf)
DEFAULT_DOMAIN="ft.programmingwitharagon.com"
DEFAULT_S3_BUCKET="ft.programmingwitharagon.com"

# S3_BUCKET and CLOUDFRONT_DISTRIBUTION_ID from env, terraform output, or defaults
if [[ -z "${S3_BUCKET:-}" ]] || [[ -z "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
  if command -v terraform &>/dev/null; then
    tf_bucket="$(terraform -chdir=terraform output -raw s3_bucket 2>/dev/null)" || true
    tf_dist="$(terraform -chdir=terraform output -raw cloudfront_distribution_id 2>/dev/null)" || true
    [[ -n "${tf_bucket:-}" && "$tf_bucket" =~ ^[a-zA-Z0-9._-]+$ ]] && S3_BUCKET="${S3_BUCKET:-$tf_bucket}"
    [[ -n "${tf_dist:-}" && "$tf_dist" =~ ^[A-Za-z0-9]+$ ]] && CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-$tf_dist}"
  fi
fi
[[ -z "${S3_BUCKET:-}" ]] && S3_BUCKET="$DEFAULT_S3_BUCKET"
if [[ -z "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]] && command -v jq &>/dev/null; then
  CLOUDFRONT_DISTRIBUTION_ID="$(aws cloudfront list-distributions --output json 2>/dev/null | jq -r --arg a "$DEFAULT_DOMAIN" '.DistributionList.Items[]? | select(.Aliases.Items[]? == $a) | .Id' | head -1)" || true
fi

if [[ -z "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
  echo "Set CLOUDFRONT_DISTRIBUTION_ID, or from repo root run: terraform -chdir=terraform apply"
  exit 1
fi

echo "=== Install dependencies ==="
(cd family-tree-web && npm ci)

echo "=== Lint ==="
(cd family-tree-web && npm run lint)

echo "=== Build ==="
(cd family-tree-web && npm run build)

echo "=== Sync to S3 ==="
# Bucket is in us-east-1 (terraform main.tf uses provider aws.s3)
aws s3 sync family-tree-web/dist/ "s3://${S3_BUCKET}/" --delete --region us-east-1

echo "=== Invalidate CloudFront ==="
aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
