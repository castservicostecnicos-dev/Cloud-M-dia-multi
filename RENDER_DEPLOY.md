# Como Publicar o Mídia Indoor no Render (render.com)

Este projeto já está **100% preparado e testado** para rodar no Render como um **Web Service** Node.js.

---

### Opção 1: Implantação Automática via Blueprint (`render.yaml`)
1. Envie este repositório para o seu **GitHub** ou **GitLab**.
2. No painel do [Render](https://dashboard.render.com/):
   - Clique em **New +** e selecione **Blueprint**.
   - Conecte o repositório deste projeto.
   - O Render lerá automaticamente o arquivo `render.yaml` já configurado na raiz.
   - Clique em **Apply** e o deploy iniciará automaticamente!

---

### Opção 2: Implantação Manual (Web Service)
Se preferir criar o serviço manualmente no Render:
1. No painel do Render, clique em **New +** -> **Web Service**.
2. Conecte o seu repositório Git.
3. Configure os seguintes campos:
   - **Name:** `midia-indoor` (ou o nome que preferir)
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` (ou superior)
4. Na seção **Environment Variables** (Variáveis de Ambiente), adicione:
   - `PORT` = `3000` *(Importante: o servidor está configurado para a porta 3000)*
   - `NODE_ENV` = `production`
5. Na seção **Health Check Path** (Opcional, em Advanced):
   - `/api/health`
6. Clique em **Create Web Service**.

---

### Persistência de Dados e Banco de Dados (Firebase Firestore):
- **O Banco de Dados é 100% persistente na nuvem**: Todas as empresas, usuários, operadores, senhas, telas (players), playlists e programações são sincronizados automaticamente em tempo real com o **Firebase Firestore**.
- **Segurança contra novos deploys e reinicializações**: O arquivo `firebase-applet-config.json` já está incluído na raiz do projeto. Mesmo que o Render durma ou seja feito um novo deploy (que limpa o disco temporário do plano Free), ao inicializar o servidor restaura automaticamente todos os dados salvos do Firestore!
- **Variáveis de Ambiente (Opcional caso não queira subir o json para o git público)**:
  - Se preferir adicionar via variáveis de ambiente no painel do Render, você pode definir:
    - `FIREBASE_PROJECT_ID`: `deep-freedom-8szp9`
    - `FIREBASE_API_KEY`: `AIzaSyCzP6rv9WIneoF9OUDTRppATOsCLOS-vvQ`
    - `FIRESTORE_DATABASE_ID`: `ai-studio-remixmdiaindoor2-b21786e5-9cc2-4541-8854-9ca7fb6c84ba`
    - `FIREBASE_APP_ID`: `1:676316244483:web:bc8f3491e953b884c9fc36`
    - `FIREBASE_AUTH_DOMAIN`: `deep-freedom-8szp9.firebaseapp.com`
---

### Configuração do Google Drive no Render (Passo a Passo Completo):

Para que os arquivos de mídia carregados por **qualquer empresa cliente** sejam salvos automaticamente no Google Drive da sua conta previamente cadastrada no seu app publicado em `https://cast-storemidia-1.onrender.com`:

#### 1. Autorizar o Domínio do Render no Google Cloud Console
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) com a sua conta (`ale11062@gmail.com`) e selecione o projeto: **`gen-lang-client-0937994667`**.
2. No menu lateral à esquerda, vá em **APIs e Serviços** > **Credenciais**.
3. Na seção **IDs do cliente OAuth 2.0**, clique no cliente Web do aplicativo.
4. Na seção **Origens JavaScript autorizadas**, clique em **Adicionar URI** e insira exatamente:
   - `https://cast-storemidia-1.onrender.com`
5. Na seção **URIs de redirecionamento autorizados**, clique em **Adicionar URI** e insira exatamente:
   - `https://cast-storemidia-1.onrender.com`
   - `https://gen-lang-client-0937994667.firebaseapp.com/__/auth/handler`
6. Clique em **Salvar** no rodapé da página.

#### 2. Autorizar o Domínio do Render no Firebase Authentication
1. Acesse o [Console do Firebase](https://console.firebase.google.com/) e selecione o projeto: **`gen-lang-client-0937994667`**.
2. No menu lateral, clique em **Criação** (ou Build) > **Authentication (Autenticação)**.
3. Clique na aba superior **Settings (Configurações)** > submenu **Authorized domains (Domínios autorizados)**.
4. Clique em **Add domain (Adicionar domínio)** e digite exatamente:
   - `cast-storemidia-1.onrender.com`
5. Clique em **Adicionar**.

#### 3. Realizar o Cadastro Prévio da Conta Google no App Publicado
1. Abra o link do seu app no navegador: [https://cast-storemidia-1.onrender.com/](https://cast-storemidia-1.onrender.com/)
2. Faça login como **Administrador** (ou com suas credenciais de DEV).
3. Vá até a aba **Google Drive / Central de Arquivos**.
4. Clique no botão azul **"Conectar Conta Google Central"**.
5. Uma janela pop-up do Google abrirá já sugerindo a conta: selecione a conta Google **`cast.servicostecnicos@gmail.com`** e confirme a permissão para gerenciar os arquivos no Google Drive.
6. Pronto! O sistema exibirá o selo verde:
   `✓ Conta Central Cadastrada: cast.servicostecnicos@gmail.com`.
7. Clique em **"Sincronizar Pastas no Drive"** para criar instantaneamente no Google Drive da conta `cast.servicostecnicos@gmail.com` a pasta:
   - `📁 MÍDIA INDOOR - ARQUIVOS DO SISTEMA`
   - E dentro dela, as pastas organizadas para cada cliente cadastrado.

#### 4. Como as Empresas Clientes Realizam o Sincronismo
- Uma vez concluído o passo 3 acima, **nenhuma empresa cliente precisará de conta Google nem de login adicional**.
- Quando a empresa acessar o painel dela no Render e fizer upload de uma foto ou vídeo, o backend do app salva o arquivo automaticamente na respectiva pasta do seu Google Drive com um código único (ex.: `FOTO-CLI-ABCD`) e gera a URL pública de streaming de alta resolução direto para as TVs.

---

### Web Service vs. Static Site no Render (Dúvida Frequente):
- **O app pode rodar como um "Static Site" puro (sem backend)?**
  - **NÃO como um serviço isolado**. Um "Static Site" serve apenas arquivos HTML/JS/CSS estáticos e **não executa Node.js**.
  - Este aplicativo necessita do servidor Node.js/Express (`server.ts`) para processar as rotas de API vitais:
    1. **Autenticação**: login com validação de senhas com hash e controle de sessões.
    2. **Monitoramento e Heartbeat dos Players**: comunicação contínua das TVs com o servidor.
    3. **Tempo Real (SSE)**: chamada de senhas pelos operadores transmitida instantaneamente para a TV.
    4. **Sincronização com o Firestore**: gestão de dados, planos, cotas e feeds RSS.
    5. **Uploads de Mídia Locais**: recebimento e armazenamento de arquivos no servidor.
  - Portanto, alterar o tipo de serviço no Render para "Static Site" sem um backend causará erros `404 Not Found` em todas as ações do sistema.

- **É possível usar a arquitetura híbrida (Frontend em Static Site + Backend em Web Service)?**
  - **SIM!** O código já foi preparado para isso:
    - O backend possui suporte completo a **CORS** ativado para qualquer origem.
    - O frontend aceita a variável `VITE_API_BASE_URL` para apontar para o seu Web Service Node.js (ex: `https://meu-backend.onrender.com/api`).
    - Assim, se você criar um **Static Site** no Render apenas para o frontend, basta configurar a variável de ambiente `VITE_API_BASE_URL` nele apontando para a URL do seu **Web Service** de backend!
  - **Recomendação mais simples:** Manter como **Web Service** unificado (Opção 1 ou 2 acima), onde frontend e backend rodam juntos no mesmo serviço sem custo adicional nem necessidade de gerenciar dois serviços.
