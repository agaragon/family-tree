#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# S3_BUCKET and CLOUDFRONT_DISTRIBUTION_ID from env, or from terraform output
if [[ -z "${S3_BUCKET:-}" ]] || [[ -z "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
  if command -v terraform &>/dev/null; then
    S3_BUCKET="${S3_BUCKET:-$(terraform -chdir=terraform output -raw s3_bucket 2>/dev/null)}"
    CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-$(terraform -chdir=terraform output -raw cloudfront_distribution_id 2>/dev/null)}"
  fi
fi

if [[ -z "${S3_BUCKET:-}" ]] || [[ -z "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
  echo "Set S3_BUCKET and CLOUDFRONT_DISTRIBUTION_ID, or run from a dir with terraform state."
  exit 1
fi

echo "=== Install dependencies ==="
(cd family-tree-web && npm ci)

echo "=== Lint ==="
(cd family-tree-web && npm run lint)

echo "=== Build ==="
(cd family-tree-web && npm run build)

echo "=== Sync to S3 ==="
aws s3 sync family-tree-web/dist/ "s3://${S3_BUCKET}/" --delete

echo "=== Invalidate CloudFront ==="
aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
