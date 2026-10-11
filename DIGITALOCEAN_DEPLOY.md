# 🚀 Guia de Implantação na DigitalOcean (Rodando seus 5 Apps em 1 Droplet)

Com este guia, você conseguirá rodar o **Mídia Indoor**, o **Inspect (Vistorias)**, o **Quote (Orçamentos)**, a **Calculadora Térmica** e o **Orçamento Solar** dentro de **uma única máquina (Droplet)** na DigitalOcean pagando apenas o valor fixo mensal da máquina (a partir de **$4 ou $6/mês**), todos funcionando 24 horas por dia, 7 dias por semana!

---

## 1. Escolhendo o Droplet na DigitalOcean

1. Entre no seu painel da [DigitalOcean](https://cloud.digitalocean.com/).
2. Clique em **Create** &rarr; **Droplets**.
3. **Distribuição:** Escolha **Ubuntu 24.04 LTS**.
4. **Plano:**
   - **Recomendado para os 5 apps juntos:** **Basic Droplet** com **2 GB de RAM / 1 vCPU / 50 GB SSD** ($12/mês) ou **1 GB de RAM** ($6/mês para começar se usar Docker leve/swap).
5. **Autenticação:** Escolha **SSH Key** (ou defina uma senha root segura).
6. Clique em **Create Droplet**. Em ~40 segundos você receberá o **IP do Droplet** (ex: `159.203.88.90`).

---

## 2. Preparando o Servidor (Conexão SSH)

Abra o terminal do seu computador (ou use o Console Web no painel da DigitalOcean):

```bash
ssh root@SEU_IP_DO_DROPLET
```

Atualize os pacotes do sistema:
```bash
apt update && apt upgrade -y
```

Instale o **Docker**, o **Docker Compose** e o **Nginx**:
```bash
apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx git
systemctl enable docker
systemctl start docker
```

---

## 3. Subindo o Mídia Indoor

1. Clone ou envie o repositório do Mídia Indoor para o servidor:
```bash
git clone https://github.com/SEU-USUARIO/SEU-REPOSITORIO-MIDIA.git /var/www/midia-indoor
cd /var/www/midia-indoor
```

2. Crie o arquivo `.env` com as configurações do banco Firebase:
```bash
cat << 'EOF' > .env
PORT=3000
NODE_ENV=production
FIREBASE_PROJECT_ID=gen-lang-client-0937994667
FIRESTORE_DATABASE_ID=ai-studio-mdiaindoor-0ee6f26d-4225-42ad-910a-5d51615f2900
EOF
```

3. Inicie a aplicação com o Docker:
```bash
docker-compose up -d --build
```
*O Mídia Indoor estará rodando internamente na porta 3000.*

---

## 4. Configurando seus Outros Aplicativos na Mesma Máquina

Cada aplicativo rodará em uma porta diferente no mesmo servidor:
- **Mídia Indoor:** Porta `3000`
- **Inspect (Vistorias):** Porta `3001`
- **Quote (Orçamentos):** Porta `3002`
- **Calculadora Térmica:** Porta `3003`
- **Orçamento Solar:** Porta `3004`

Basta clonar cada projeto em uma pasta (ex: `/var/www/inspect`, `/var/www/quote`), criar o Dockerfile ou rodar com Node/Docker expondo a respectiva porta.

---

## 5. Configurando o Nginx (Direcionando Domínios e Tempo Real)

Copie a configuração de proxy reverso preparada para o Mídia Indoor:

```bash
cp /var/www/midia-indoor/nginx-midia.conf /etc/nginx/sites-available/midia.seudominio.com.br
```

Edite o domínio para o seu domínio real:
```bash
nano /etc/nginx/sites-available/midia.seudominio.com.br
```

Ative o site no Nginx:
```bash
ln -s /etc/nginx/sites-available/midia.seudominio.com.br /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Para os outros apps:
Basta duplicar o arquivo de configuração para cada domínio alterando apenas a porta (`proxy_pass http://127.0.0.1:3001;`, etc.).

---

## 6. Ativando Certificado SSL Grátis (HTTPS)

Execute o Certbot para gerar SSL gratuito automaticamente:

```bash
certbot --nginx -d midia.seudominio.com.br
```

O Certbot configurará a renovação automática para você. Suas TVs comerciais e painéis agora abrirão em HTTPS com cadeado verde e sem nenhum custo adicional.

---

## 7. Comandos Úteis do Dia a Dia

- **Ver status dos containers:** `docker ps`
- **Ver logs do Mídia Indoor em tempo real:** `docker logs -f app-midia-indoor`
- **Reiniciar o app:** `docker-compose restart`
- **Atualizar código com nova versão do GitHub:**
  ```bash
  git pull
  docker-compose up -d --build
  ```

Pronto! Todos os seus 5 sistemas estarão rodando 24 horas por dia na mesma infraestrutura sem risco de hibernar e com máxima performance.
