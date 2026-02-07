# Family Tree

A family tree web app built with React and Vite.

## Development

```bash
cd family-tree-web
npm install
npm run dev
```

## Deploy to family-tree.programmingwitharagon.com

The site is deployed to **family-tree.programmingwitharagon.com** using AWS (S3 + CloudFront + Route53) and Terraform.

### Prerequisites

- [Terraform](https://www.terraform.io/downloads) ≥ 1.0
- [AWS CLI](https://aws.amazon.com/cli/) configured (credentials with permissions for S3, CloudFront, Route53, ACM)
- The domain **programmingwitharagon.com** must have a **Route53 hosted zone** in your AWS account.  
  If it’s currently at another DNS provider, create a hosted zone in Route53 and update your registrar’s nameservers to the NS records of that zone.

### One-time setup

1. **Get your Route53 zone ID**  
   In AWS Console → Route53 → Hosted zones, open **programmingwitharagon.com** and copy the **Hosted zone ID** (e.g. `Z0123456789ABCDEFGHIJ`).

2. **Configure Terraform**  
   From the project root:
   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   ```
   Edit `terraform.tfvars` and set `route53_zone_id` to that value.  
   Optionally set `aws_region`, `domain`, or `subdomain` (defaults: `us-east-1`, `programmingwitharagon.com`, `family-tree`).

3. **Create infrastructure**
   ```bash
   terraform init
   terraform plan   # optional: review changes
   terraform apply
   ```
   When prompted, type `yes`. Note the outputs: **url**, **s3_bucket**, **cloudfront_distribution_id**.

### Deploy (or update) the site

After the first `terraform apply`, any time you want to publish a new version:

1. **Build the app**
   ```bash
   cd family-tree-web
   npm run build
   ```

2. **Upload to S3**
   ```bash
   aws s3 sync dist/ s3://BUCKET_NAME/ --delete
   ```
   Replace `BUCKET_NAME` with the `s3_bucket` value from `terraform output` (or run `terraform output s3_bucket`).

3. **Invalidate CloudFront cache** (so changes show immediately)
   ```bash
   aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"
   ```
   Replace `DISTRIBUTION_ID` with `terraform output cloudfront_distribution_id`.

The site will be live at **https://family-tree.programmingwitharagon.com**.

### Destroy

To remove all resources:

```bash
cd terraform
terraform destroy
```

Type `yes` when prompted.
