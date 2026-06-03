#!/bin/bash
# =============================================================================
#  install.sh — Instalador do Sistema Condominial
#  Plataforma: Debian (CT LXC no Proxmox)
#  Serviços instalados: Node.js, PocketBase, Tailscale, Cloudflared, App
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PB_VERSION="0.27.1"
PB_DIR="/opt/pocketbase"
NODE_VERSION="20"

print_header() {
  echo -e "\n${CYAN}========================================${NC}"
  echo -e "${CYAN}  Sistema Condominial — Instalador${NC}"
  echo -e "${CYAN}========================================${NC}\n"
}

print_step() {
  echo -e "\n${GREEN}[+] $1${NC}"
}

print_warn() {
  echo -e "${YELLOW}[!] $1${NC}"
}

print_error() {
  echo -e "${RED}[x] $1${NC}"
}

confirm() {
  read -rp "$(echo -e "${CYAN}$1 [s/N]: ${NC}")" ans
  case "$ans" in [Ss]*) return 0 ;; *) return 1 ;; esac
}

# =============================================================================
#  COLETA DE CONFIGURACOES
# =============================================================================

collect_config() {
  print_header

  echo -e "${CYAN}Este script ira instalar e configurar o Sistema Condominial.${NC}"
  echo -e "${CYAN}Responda as perguntas abaixo para personalizar a instalacao.${NC}\n"

  # Nome do condominio
  while true; do
    read -rp "$(echo -e "${CYAN}Nome do condominio (ex: Residencial Aurora): ${NC}")" APP_NAME
    [[ -n "$APP_NAME" ]] && break
    print_warn "O nome nao pode ser vazio."
  done

  # URL publica via Cloudflare Tunnel
  while true; do
    read -rp "$(echo -e "${CYAN}URL publica do app (ex: https://condo.seudominio.com): ${NC}")" APP_URL
    [[ "$APP_URL" =~ ^https?:// ]] && break
    print_warn "A URL deve comecar com http:// ou https://"
  done

  # E-mail do admin principal
  while true; do
    read -rp "$(echo -e "${CYAN}E-mail do administrador principal (sindico): ${NC}")" ADMIN_EMAIL
    [[ "$ADMIN_EMAIL" =~ @ ]] && break
    print_warn "Insira um e-mail valido."
  done

  # Senha do admin principal
  while true; do
    read -rsp "$(echo -e "${CYAN}Senha do administrador (minimo 8 caracteres): ${NC}")" ADMIN_PASSWORD
    echo
    [[ ${#ADMIN_PASSWORD} -ge 8 ]] && break
    print_warn "A senha deve ter no minimo 8 caracteres."
  done
  read -rsp "$(echo -e "${CYAN}Confirme a senha: ${NC}")" ADMIN_PASSWORD_CONFIRM
  echo
  if [[ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]]; then
    print_error "As senhas nao coincidem. Execute o instalador novamente."
    exit 1
  fi

  # Senha do superadmin do PocketBase
  while true; do
    read -rsp "$(echo -e "${CYAN}Senha do superadmin do PocketBase (minimo 10 caracteres): ${NC}")" PB_ADMIN_PASSWORD
    echo
    [[ ${#PB_ADMIN_PASSWORD} -ge 10 ]] && break
    print_warn "A senha do PocketBase deve ter no minimo 10 caracteres."
  done

  # Cloudflare Tunnel token
  echo -e "\n${CYAN}Para configurar o Cloudflare Tunnel:${NC}"
  echo -e "${CYAN}  1. Acesse: https://one.dash.cloudflare.com/ > Networks > Tunnels${NC}"
  echo -e "${CYAN}  2. Crie um novo tunnel e copie o token exibido.${NC}"
  while true; do
    read -rp "$(echo -e "${CYAN}Token do Cloudflare Tunnel: ${NC}")" CF_TUNNEL_TOKEN
    [[ -n "$CF_TUNNEL_TOKEN" ]] && break
    print_warn "O token nao pode ser vazio."
  done

  # Tailscale auth key
  echo -e "\n${CYAN}Para configurar o Tailscale (acesso aos terminais Hikvision):${NC}"
  echo -e "${CYAN}  1. Acesse: https://login.tailscale.com/admin/settings/keys${NC}"
  echo -e "${CYAN}  2. Gere uma Auth Key (reusable recomendado) e copie.${NC}"
  while true; do
    read -rp "$(echo -e "${CYAN}Tailscale Auth Key: ${NC}")" TAILSCALE_AUTHKEY
    [[ -n "$TAILSCALE_AUTHKEY" ]] && break
    print_warn "A auth key nao pode ser vazia."
  done

  # Hostname Tailscale
  HOSTNAME_DEFAULT=$(hostname)
  read -rp "$(echo -e "${CYAN}Hostname desta maquina no Tailscale [${HOSTNAME_DEFAULT}]: ${NC}")" TS_HOSTNAME
  TS_HOSTNAME="${TS_HOSTNAME:-$HOSTNAME_DEFAULT}"

  # Gemini API Key (opcional)
  read -rp "$(echo -e "${CYAN}Gemini API Key (opcional, deixe vazio para pular): ${NC}")" GEMINI_API_KEY

  # Resumo
  echo -e "\n${CYAN}========================================${NC}"
  echo -e "${CYAN}  Resumo da Configuracao${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo -e "  Nome do condominio : ${YELLOW}${APP_NAME}${NC}"
  echo -e "  URL publica        : ${YELLOW}${APP_URL}${NC}"
  echo -e "  Admin e-mail       : ${YELLOW}${ADMIN_EMAIL}${NC}"
  echo -e "  Hostname Tailscale : ${YELLOW}${TS_HOSTNAME}${NC}"
  echo -e "  Gemini API Key     : ${YELLOW}${GEMINI_API_KEY:-"(nao configurado)"}${NC}"
  echo ""

  if ! confirm "Confirmar e iniciar a instalacao?"; then
    echo "Instalacao cancelada."
    exit 0
  fi
}

# =============================================================================
#  SISTEMA BASE
# =============================================================================

install_system_deps() {
  print_step "Atualizando sistema e instalando dependencias base..."
  apt-get update -qq
  apt-get install -y -qq \
    curl wget unzip gnupg2 ca-certificates \
    lsb-release apt-transport-https \
    software-properties-common \
    git build-essential
}

# =============================================================================
#  NODE.JS
# =============================================================================

install_nodejs() {
  if command -v node &>/dev/null; then
    print_warn "Node.js ja esta instalado: $(node -v). Pulando."
    return
  fi
  print_step "Instalando Node.js ${NODE_VERSION}..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
  echo -e "  Node.js $(node -v) instalado."
}

# =============================================================================
#  POCKETBASE
# =============================================================================

install_pocketbase() {
  print_step "Instalando PocketBase ${PB_VERSION}..."
  mkdir -p "$PB_DIR"

  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64)  PB_ARCH="amd64" ;;
    aarch64) PB_ARCH="arm64" ;;
    *) print_error "Arquitetura nao suportada: $ARCH"; exit 1 ;;
  esac

  PB_URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip"
  wget -q "$PB_URL" -O /tmp/pocketbase.zip
  unzip -q -o /tmp/pocketbase.zip -d "$PB_DIR"
  chmod +x "$PB_DIR/pocketbase"
  rm /tmp/pocketbase.zip

  cat > /etc/systemd/system/pocketbase.service <<EOF
[Unit]
Description=PocketBase - Sistema Condominial
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${PB_DIR}
ExecStart=${PB_DIR}/pocketbase serve --http=127.0.0.1:8090
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable pocketbase >/dev/null 2>&1
  systemctl start pocketbase
  sleep 3
  echo -e "  PocketBase iniciado em http://127.0.0.1:8090"

  print_step "Configurando superadmin do PocketBase..."
  PB_ADMIN_EMAIL_PB="admin@pb.local"
  "$PB_DIR/pocketbase" superuser upsert "$PB_ADMIN_EMAIL_PB" "$PB_ADMIN_PASSWORD" \
    --dir="$PB_DIR" 2>/dev/null || true
  echo -e "  Superadmin PocketBase: ${PB_ADMIN_EMAIL_PB}"
}

# =============================================================================
#  CLOUDFLARE TUNNEL
# =============================================================================

install_cloudflared() {
  print_step "Instalando Cloudflare Tunnel (cloudflared)..."

  if ! command -v cloudflared &>/dev/null; then
    ARCH=$(uname -m)
    case "$ARCH" in
      x86_64)  CF_ARCH="amd64" ;;
      aarch64) CF_ARCH="arm64" ;;
      *) print_error "Arquitetura nao suportada: $ARCH"; exit 1 ;;
    esac
    wget -q "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" \
      -O /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
  else
    print_warn "cloudflared ja esta instalado. Pulando download."
  fi

  cat > /etc/systemd/system/cloudflared.service <<EOF
[Unit]
Description=Cloudflare Tunnel - Sistema Condominial
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel --no-autoupdate run --token ${CF_TUNNEL_TOKEN}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable cloudflared >/dev/null 2>&1
  systemctl start cloudflared
  echo -e "  Cloudflare Tunnel ativo."
}

# =============================================================================
#  TAILSCALE
# =============================================================================

install_tailscale() {
  print_step "Instalando Tailscale..."

  if ! command -v tailscale &>/dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh >/dev/null 2>&1
  else
    print_warn "Tailscale ja esta instalado. Pulando download."
  fi

  systemctl enable tailscaled >/dev/null 2>&1
  systemctl start tailscaled

  print_step "Autenticando no Tailscale (hostname: ${TS_HOSTNAME})..."
  tailscale up --authkey="$TAILSCALE_AUTHKEY" --hostname="$TS_HOSTNAME" --accept-routes 2>/dev/null || \
    print_warn "Tailscale up falhou. Verifique a auth key e rode 'tailscale up' manualmente."

  TS_IP=$(tailscale ip -4 2>/dev/null || echo "verificar manualmente")
  echo -e "  Tailscale configurado. IP: ${TS_IP}"
}

# =============================================================================
#  APLICACAO NODE
# =============================================================================

install_app() {
  print_step "Instalando dependencias Node.js..."
  cd "$APP_DIR"
  npm install --silent

  print_step "Gerando arquivo .env..."
  cat > "$APP_DIR/.env" <<EOF
# Gerado automaticamente pelo install.sh em $(date '+%Y-%m-%d %H:%M:%S')

# Nome do condominio
VITE_APP_NAME="${APP_NAME}"

# URL publica do app
APP_URL="${APP_URL}"
VITE_APP_URL="${APP_URL}"

# PocketBase
POCKETBASE_URL=http://127.0.0.1:8090
VITE_POCKETBASE_URL=http://localhost:8090
POCKETBASE_ADMIN_EMAIL=admin@pb.local
POCKETBASE_ADMIN_PASSWORD="${PB_ADMIN_PASSWORD}"

# Admin principal do app
VITE_ADMIN_EMAIL="${ADMIN_EMAIL}"
ADMIN_PASSWORD="${ADMIN_PASSWORD}"

# Gemini API (opcional)
GEMINI_API_KEY="${GEMINI_API_KEY}"
EOF

  print_step "Compilando o app (npm run build)..."
  npm run build

  print_step "Inicializando colecoes do PocketBase..."
  npm run pb:setup 2>/dev/null || print_warn "pb:setup falhou. Execute 'npm run pb:setup' manualmente apos a instalacao."

  # systemd service para o app
  cat > /etc/systemd/system/condo-app.service <<EOF
[Unit]
Description=Sistema Condominial - App Node.js
After=network.target pocketbase.service

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/npx tsx ${APP_DIR}/server.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable condo-app >/dev/null 2>&1
  systemctl start condo-app
  sleep 3
  echo -e "  App iniciado na porta 3000."
}

# =============================================================================
#  SCRIPT DE ATUALIZACAO
# =============================================================================

create_update_script() {
  print_step "Criando script de atualizacao..."
  cat > "$APP_DIR/update.sh" <<'UPDATEEOF'
#!/bin/bash
# update.sh — Atualiza o Sistema Condominial a partir do GitHub
set -e
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[+] Atualizando codigo via git..."
cd "$APP_DIR"
git pull origin main

echo "[+] Instalando dependencias..."
npm install --silent

echo "[+] Compilando..."
npm run build

echo "[+] Reiniciando servicos..."
systemctl restart condo-app
systemctl restart pocketbase

echo "[v] Atualizacao concluida."
UPDATEEOF
  chmod +x "$APP_DIR/update.sh"
}

# =============================================================================
#  RESUMO FINAL
# =============================================================================

print_summary() {
  echo -e "\n${GREEN}========================================${NC}"
  echo -e "${GREEN}  Instalacao Concluida!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo -e "\n  ${CYAN}Condominio  :${NC} ${APP_NAME}"
  echo -e "  ${CYAN}URL publica :${NC} ${APP_URL}"
  echo -e "  ${CYAN}Admin       :${NC} ${ADMIN_EMAIL}"
  echo -e "\n  ${CYAN}Servicos systemd:${NC}"
  echo -e "    pocketbase   -> systemctl status pocketbase"
  echo -e "    condo-app    -> systemctl status condo-app"
  echo -e "    cloudflared  -> systemctl status cloudflared"
  echo -e "    tailscaled   -> systemctl status tailscaled"
  echo -e "\n  ${CYAN}Logs do app:${NC}"
  echo -e "    journalctl -u condo-app -f"
  echo -e "\n  ${CYAN}Para atualizar no futuro:${NC}"
  echo -e "    bash ${APP_DIR}/update.sh"
  echo -e "\n  ${YELLOW}PocketBase admin UI:${NC} http://127.0.0.1:8090/_/"
  echo -e "    Login: admin@pb.local / (senha definida na instalacao)"
  echo ""
}

# =============================================================================
#  MAIN
# =============================================================================

if [[ "$EUID" -ne 0 ]]; then
  print_error "Execute este script como root: sudo bash install.sh"
  exit 1
fi

collect_config
install_system_deps
install_nodejs
install_pocketbase
install_cloudflared
install_tailscale
install_app
create_update_script
print_summary
