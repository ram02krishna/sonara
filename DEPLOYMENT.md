# Deploying Sonara: Vercel + AWS EC2 (Docker Hub, nginx, CI/CD)

```
                         ┌────────────────────────── Vercel ───────────────────────────┐
 Browser ── https ─────► │ Next.js web app   (rewrites /api/v1/* → https://api.<you>) │
                         └───────────────────────────────┬─────────────────────────────┘
                                                         │ https
                              ┌───────────── AWS EC2 (one Ubuntu server) ─────────────┐
                              │  nginx :80/:443  (TLS from Let's Encrypt, auto-renew) │
                              │     └─► api  (Go, pulled automatically from DockerHub)│
                              │            ├─► postgres (Docker volume)               │
                              │            └─► redis    (Docker volume)               │
                              └────────────────────────────────────────────────────────┘

 git push main ─► GitHub Actions: test ─► build & push to Docker Hub ─► SSH to EC2 ─► pull & restart
 git push main ─► Vercel builds and publishes the web app automatically
```

**Architecture summary:**
- **Web App**: Hosted on Vercel. Next.js proxies `/api/v1` to your EC2 API domain so cookies remain first-party.
- **Backend API + DB**: Runs directly on **AWS EC2** inside Docker Compose (Go API, PostgreSQL, Redis, Nginx, Certbot).
- **Docker Registry**: **Docker Hub** (`<your-username>/sonara-api:latest`). GitHub Actions builds the image and pushes to Docker Hub; EC2 pulls and deploys automatically.
- **No AWS ECR required**: No AWS IAM access keys or ECR costs.
- **No shell scripts required**: Fully automated using GitHub Actions and Docker Compose.

---

## 1. One-time AWS EC2 setup

You only need **one EC2 instance** running Ubuntu.

### 1.1 Launch an EC2 Instance
- **AMI**: Ubuntu Server 24.04 (or 22.04) **x86_64**.
- **Instance Type**: `t3.small` (2 GB RAM) recommended, or `t3.micro`. Storage: 20 GB gp3.
- **Key Pair**: Create or use an existing key pair (`.pem`) for SSH access.
- **Security Group (Inbound rules)**:
  - `SSH` (port 22) from anywhere (or your IP + GitHub runners).
  - `HTTP` (port 80) from anywhere (needed for Let's Encrypt certificate challenge).
  - `HTTPS` (port 443) from anywhere.
  *(Keep ports 5432, 6379, and 8080 closed; they only communicate internally inside Docker).*
- **Elastic IP**: Allocate an Elastic IP and associate it with your EC2 instance (so your server IP never changes).

### 1.2 DNS Configuration
Create an **A record** in your domain registrar / DNS provider:
```
api.yourdomain.com  ──►  <Your-Elastic-IP>
```
Wait a few minutes until `nslookup api.yourdomain.com` resolves to your Elastic IP.

---

## 2. One-time Server Preparation

Connect to your EC2 instance via SSH:

```bash
ssh -i your-key.pem ubuntu@<YOUR_ELASTIC_IP>
```

Install Docker and Docker Compose (standard 1-line script):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Log out and back in so group permissions take effect:

```bash
exit
ssh -i your-key.pem ubuntu@<YOUR_ELASTIC_IP>
```

Create the application folder and configuration file:

```bash
mkdir -p ~/sonara
cd ~/sonara
nano .env
```

Paste and fill in your production values:

```env
DOCKERHUB_USERNAME=your_dockerhub_username

DOMAIN=api.yourdomain.com
LETSENCRYPT_EMAIL=your-email@example.com
ALLOWED_ORIGINS=https://your-sonara-app.vercel.app

POSTGRES_USER=sonara
POSTGRES_DB=sonara
POSTGRES_PASSWORD=generate_with_openssl_rand_hex_24

SESSION_SECRET=generate_with_openssl_rand_hex_32
TOKEN_ENCRYPTION_KEY=generate_with_openssl_rand_hex_32

SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_DEFAULT_MARKET=IN
LRCLIB_API_URL=https://lrclib.net/api
YOUTUBE_API_KEY=
```

*(You can generate secure random keys using `openssl rand -hex 32` directly in your terminal).*

---

## 3. GitHub Actions CI/CD Configuration

In your GitHub repository, navigate to **Settings → Secrets and variables → Actions → New repository secret** and add these secrets:

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Your Docker Hub personal access token (create one at [hub.docker.com/settings/security](https://hub.docker.com/settings/security)) |
| `EC2_HOST` | Your EC2 Elastic IP address (or `api.yourdomain.com`) |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | The private SSH key (`.pem` file text) used to connect to your instance |

---

## 4. Automatic Deployment

Whenever you push to the `main` branch (or trigger the workflow manually in the Actions tab):
1. **GitHub Actions** runs the lint and test suite.
2. It builds the API Docker image (`linux/amd64`) and pushes it to Docker Hub as `<username>/sonara-api:latest`.
3. It SSHes into your EC2 server, syncs the production configuration, and triggers Docker to pull the new image from Docker Hub.
4. It restarts the containers (`docker compose up -d`).
5. On the first deployment, **Certbot** automatically issues a Let's Encrypt TLS certificate for your domain.
6. The workflow waits for the `/healthz` endpoint to report healthy before succeeding.

Test that the API is up:
```bash
curl https://api.yourdomain.com/healthz
# {"status":"healthy","service":"sonara-api"}
```

---

## 5. Vercel Web Deployment

1. Go to **Vercel** → **Add New → Project** → Import your repository.
2. Under **Root Directory**, set it to `apps/web`.
3. Under **Environment Variables**, add:
   - `API_INTERNAL_URL`: `https://api.yourdomain.com`
4. Click **Deploy**.
5. Once your Vercel deployment URL is ready, ensure it is added to `ALLOWED_ORIGINS` in your EC2 `.env` file.

---

## 6. Maintenance & Useful Commands

All operational commands run directly on the EC2 host inside `~/sonara`:

```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# View live API logs
docker compose -f docker-compose.prod.yml logs -f api

# Pull latest image from Docker Hub manually
docker compose -f docker-compose.prod.yml pull api

# Restart all services
docker compose -f docker-compose.prod.yml restart

# Database backup
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U sonara sonara | gzip > backup-$(date +%F).sql.gz
```

Certificates are checked and renewed automatically by the `certbot` container twice every day.
