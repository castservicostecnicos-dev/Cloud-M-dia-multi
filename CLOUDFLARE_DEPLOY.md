# Como Publicar Este Aplicativo 100% no Cloudflare Pages com Firebase (Sem Render)

Este aplicativo foi configurado para rodar **100% no Cloudflare Pages**, com o banco de dados e autenticação rodando diretamente no **Firebase Firestore**, **sem necessidade de hospedar nenhum backend no Render.com**.

---

## 1. Pages ou Workers: Qual é a melhor opção para este app?

**A MELHOR OPÇÃO É O CLOUDFLARE PAGES.**

### Por quê?
1. **Natureza do App (Frontend SPA com Vite + React + PWA):**
   - O aplicativo é uma Single Page Application (SPA) com PWA que precisa servir arquivos HTML, CSS, JavaScript e imagens com alta performance.
   - O **Cloudflare Pages** foi desenvolvido especificamente para hospedar projetos como Vite, React e Next.js estático na rede global da Cloudflare (mais de 330 cidades no mundo).
2. **Custo e Limites 100% Gratuitos:**
   - O **Cloudflare Pages** tem **largura de banda ilimitada** e requisições ilimitadas no plano gratuito.
   - O **Cloudflare Workers** impõe um limite de 100.000 requisições/dia no plano gratuito e exige configurações avançadas de bundle (`wrangler`) apenas para conseguir servir arquivos de frontend.
3. **Banco de Dados Direto no Firebase Firestore:**
   - Todas as operações (login, empresas, players, operadores, playlists, mídias e chamadas em tempo real) comunicam-se diretamente com o **Firebase Firestore** do navegador do usuário através do SDK client do Firebase.
   - Não há necessidade de manter um servidor Node.js intermediário no Render.com.
4. **Deploy Automático Contínuo:**
   - Você conecta seu repositório GitHub uma única vez no Cloudflare Pages; a cada `git push`, o Cloudflare gera o build (`npm run build`) e publica sua versão em segundos, com HTTPS automático e domínio gratuito `.pages.dev`.

---

## 2. Passo a Passo para Publicar no Cloudflare Pages (Em menos de 3 minutos)

### Passo 1: Enviar o código para o GitHub
Se ainda não enviou, suba o repositório deste projeto para o seu GitHub (público ou privado).

### Passo 2: Criar o Projeto no Cloudflare Pages
1. Acesse o painel da [Cloudflare](https://dash.cloudflare.com/) e faça login.
2. No menu lateral, clique em **Workers & Pages**.
3. Clique no botão azul **Create application** (Criar aplicativo).
4. Selecione a aba **Pages** e clique em **Connect to Git** (Conectar ao Git).
5. Autorize o GitHub e escolha o repositório deste aplicativo.
6. Clique em **Begin setup** (Iniciar configuração).

### Passo 3: Configurações de Build (Pré-definidas)
Na tela de configuração de build, preencha exatamente assim:

| Campo | Valor |
| :--- | :--- |
| **Project name** | `midia-indoor` (ou o nome que preferir) |
| **Production branch** | `main` (ou a branch principal do seu repositório) |
| **Framework preset** | `Vite` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` (deixar em branco ou raiz) |

### Passo 4: Concluir e Publicar
1. Clique no botão **Save and Deploy**.
2. A Cloudflare iniciará a compilação e, em cerca de 1 a 2 minutos, seu app estará no ar com a URL oficial:
   `https://midia-indoor.pages.dev` (ou o nome escolhido).

---

## 3. Recursos Já Prontos e Pré-configurados no Projeto

1. **SPA Routing sem erro 404:**
   - O arquivo `public/_redirects` já está criado com a regra `/* /index.html 200`. Isso garante que ao recarregar a tela em rotas internas do player ou dos painéis, o navegador nunca exibirá erro 404 no Cloudflare Pages.
2. **Conexão Nativa com Firebase Firestore:**
   - O arquivo `firebase-applet-config.json` já está na raiz do projeto com as credenciais ativas do seu projeto Firebase.
   - O motor `src/lib/clientFirestoreFallback.ts` processa todas as leituras e gravações (empresas, telas, playlists, operadores e mídias) diretamente na nuvem do Firestore.
3. **Google Drive Exclusivo do DEV:**
   - O Google Drive com a conta **`cast.servicostecnicos@gmail.com`** está restrito **exclusivamente ao Painel do Administrador Geral (DEV)**.
   - As empresas e operadores não possuem acesso ou visibilidade ao Drive, mantendo suas pastas e mídias sob total controle do seu painel administrativo.
