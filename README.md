# Family Tree

A family tree web app built with React and Vite. Build and edit genealogical graphs with drag-and-drop nodes, parent-child connections, and various export options.

## Features

- **Add members** — Click on empty canvas space to add a new family member.
- **Edit names** — Double-click a member's name to edit (single-click on touch devices). Press Enter to confirm, Escape to cancel.
- **Delete members** — Click the × button on a member node.
- **Connect parents and children** — Drag from the bottom handle (source) of a parent to the top handle (target) of a child. Connect two parents to the same child to represent a couple.
- **Remove connections** — Select an edge and press Delete or Backspace.
- **Reposition nodes** — Drag nodes to arrange the tree manually.
- **Pan and zoom** — Use the mouse or touch to pan and zoom the canvas.
- **Auto-save** — The tree is saved automatically to local storage.
- **Share via URL** — Open a link with the tree encoded in the URL to view or collaborate; the app loads the shared tree on first visit.
- **Export** — Export to PDF, copy a share link to the clipboard, or download the tree as JSON.
- **Background image** — Import a custom background image (e.g. a photo); it is stored locally and not included in share links.

## Instructions bar

The instructions bar (sidebar) shows tips and action buttons.

### Tips

- **Same row = same generation** — Siblings and cousins are placed on the same horizontal line.
- **Click to add member** — Click on empty canvas space.
- **Double-click name to edit** — Or single-click on touch devices.
- **Connect handles** — Drag from parent handles to child handles; two parents → one child = couple.
- **Delete to remove connection** — Select an edge and press Delete or Backspace.

### Actions

| Button | Description |
|--------|-------------|
| **Alinhar** | Auto-align nodes by generation (repositions nodes into tidy rows). |
| **Configurações avançadas** | Expand/collapse advanced settings panel. |
| **Importar fundo** | Choose a background image from your device (not shared in links). |
| **Exportar link** | Copy a shareable URL to the clipboard. |
| **Exportar JSON** | Download the tree as a JSON file. |
| **Paper size (A4 / A1 / A0)** | Select PDF page size before exporting. |
| **Exportar PDF** | Export the visible tree as a PDF. |
| **Limpar árvore** | Clear the entire tree (asks for confirmation; cannot be undone). |

### Advanced settings

When "Configurações avançadas" is expanded:

- **Tamanho do nó** — Node size (0.5–2).
- **Cor do nó** — Node fill color.
- **Espessura da linha** — Edge stroke width (1–8).
- **Cor da linha** — Edge stroke color.
- **Restaurar padrões** — Reset all settings to defaults.

## Development

```bash
cd family-tree-web
npm install
npm run dev
```

## Deploy to your own domain

The site can be deployed to any domain using AWS (S3 + CloudFront + Route53) and Terraform.

### Prerequisites

- [Terraform](https://www.terraform.io/downloads) ≥ 1.0
- [AWS CLI](https://aws.amazon.com/cli/) configured (credentials with permissions for S3, CloudFront, Route53, ACM)
- Your domain must have a **Route53 hosted zone** in your AWS account.  
  If it’s currently at another DNS provider, create a hosted zone in Route53 and update your registrar’s nameservers to the NS records of that zone.

### One-time setup

1. **Configure Terraform (optional)**  
   Defaults deploy to `ft.programmingwitharagon.com`. To use another domain, from the project root:
   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   ```
   Edit `terraform.tfvars` and set `domain` and `subdomain` (e.g. `example.com` and `ft` for `ft.example.com`). Optionally set `aws_region`. The Route53 hosted zone is looked up by `domain`; no zone ID needed.

2. **Create infrastructure**
   ```bash
   terraform init
   terraform plan   # optional: review changes
   terraform apply
   ```
   When prompted, type `yes`. Note the outputs: **url**, **s3_bucket**, **cloudfront_distribution_id**. Terraform will not prompt for variables if defaults or `terraform.tfvars` are used.

### Deploy (or update) the site

**Option A: GitHub Actions (recommended)**

A workflow in `.github/workflows/deploy.yml` builds and deploys on every push to `master`.

1. **Configure GitHub secrets** (Settings → Secrets and variables → Actions):
   - `AWS_ACCESS_KEY_ID` – AWS access key with S3 and CloudFront permissions
   - `AWS_SECRET_ACCESS_KEY` – corresponding secret key
   - `S3_BUCKET` – from `terraform output s3_bucket`
   - `CLOUDFRONT_DISTRIBUTION_ID` – from `terraform output cloudfront_distribution_id`

2. Push to `master` – the pipeline runs lint, build, S3 sync, and CloudFront invalidation.

**Option B: Run pipeline locally**

From the project root, with AWS CLI configured (env or `~/.aws/credentials`):

```bash
./scripts/deploy.sh
```

The script reads `S3_BUCKET` and `CLOUDFRONT_DISTRIBUTION_ID` from the environment, or fetches them from `terraform output` if Terraform is available. Same steps as GitHub Actions: lint → build → S3 sync → CloudFront invalidation.

**Option C: Manual deploy (step by step)**

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

---

The site will be live at your configured URL (e.g. **https://family-tree.example.com**).

### Destroy

To remove all resources:

```bash
cd terraform
terraform destroy
```

Type `yes` when prompted.
