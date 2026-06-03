O processo é simples. Assumindo que você já tem o CT LXC criado com Debian:

1. No CT, instale git e clone o repositório:


apt-get update && apt-get install -y git
git clone https://github.com/Strawyeye59900z/App-condom-nio.git /opt/condo
cd /opt/condo
2. Execute o instalador como root:


bash install.sh
O script vai perguntar interativamente:

Nome do condomínio
URL pública (ex: https://condo.seudominio.com)
E-mail e senha do admin (síndico)
Senha do superadmin PocketBase
Token do Cloudflare Tunnel
Auth Key do Tailscale
Hostname desta máquina no Tailscale
Gemini API Key (opcional)
E instala tudo automaticamente: Node.js, PocketBase, Cloudflare Tunnel, Tailscale, compila o app e configura todos os serviços via systemd.

Antes de rodar, você precisa ter em mãos:

O que	Onde obter
Cloudflare Tunnel token	one.dash.cloudflare.com → Networks → Tunnels → criar tunnel → copiar token
Tailscale Auth Key	login.tailscale.com/admin/settings/keys → Generate auth key
Requisitos mínimos do CT:

Debian 11 ou 12
1 vCPU, 1GB RAM (recomendado 2GB)
8GB de disco
Acesso à internet
Modo privilegiado ou nesting habilitado (necessário para o Tailscale funcionar no LXC)
Para habilitar nesting no Proxmox, antes de iniciar o CT, em Options → Features → Nesting: ✓.
