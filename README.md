# L.A. STORE — E-commerce Full Stack

> **Frontend:** HTML + CSS + JS puro · **Backend:** Node.js + Express · **Banco:** Supabase (PostgreSQL) · **Deploy:** Render (API) + Netlify/Vercel (Frontend)

---

## Estrutura do projeto

```
lastore/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── supabase.js       # Cliente Supabase
│   │   │   ├── migrate.js        # Schema SQL (cole no Supabase)
│   │   │   └── seed.js           # Dados iniciais
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT + proteção de rotas
│   │   │   └── validate.js       # Validação + error handler
│   │   ├── routes/
│   │   │   ├── auth.js           # Login, registro, perfil
│   │   │   ├── products.js       # CRUD de produtos
│   │   │   ├── orders.js         # Criação e gestão de pedidos
│   │   │   ├── contact.js        # Formulário de contato
│   │   │   └── extra.js          # Cupons, endereços, admin, pagamento
│   │   ├── utils/
│   │   │   ├── mailer.js         # E-mails transacionais
│   │   │   └── helpers.js        # Utilitários (frete, preços)
│   │   └── server.js             # Entry point
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── render.yaml               # Deploy no Render
│
└── frontend/
    ├── index.html                 # Homepage
    ├── css/
    │   └── style.css             # CSS completo
    ├── js/
    │   ├── api.js                # Cliente HTTP (todas as chamadas à API)
    │   ├── cart.js               # Carrinho (localStorage + UI)
    │   └── main.js               # Header, toast, reveal, utilitários
    ├── assets/
    │   └── svg/favicon.svg
    └── pages/
        ├── loja.html             # Catálogo com filtros e paginação
        ├── produto.html          # Página de produto dinâmica
        ├── checkout.html         # Checkout em 3 passos
        ├── cliente.html          # Login + Área do cliente
        ├── admin.html            # Painel administrativo
        ├── sobre.html            # Sobre a marca
        └── contato.html          # Contato + FAQ
```

---

## 1. Supabase — banco de dados

### 1.1 Criar projeto
1. Acesse [supabase.com](https://supabase.com) → **New project**
2. Escolha região **South America (São Paulo)**
3. Salve a senha do banco

### 1.2 Criar as tabelas
1. No painel do Supabase → **SQL Editor** → **New query**
2. Execute o conteúdo de `backend/src/config/migrate.js` (copie o SQL da variável `SQL`)
3. Clique em **Run**

### 1.3 Obter as chaves
Em **Project Settings → API**:
- `SUPABASE_URL` → Project URL
- `SUPABASE_ANON_KEY` → anon/public
- `SUPABASE_SERVICE_ROLE_KEY` → service_role (**nunca exponha no frontend**)

---

## 2. Backend — Render

### 2.1 Preparar repositório
```bash
cd backend
git init
git add .
git commit -m "L.A. STORE API v1"
# Crie um repositório privado no GitHub e faça push
git remote add origin https://github.com/SEU_USUARIO/lastore-api.git
git push -u origin main
```

### 2.2 Deploy no Render
1. Acesse [render.com](https://render.com) → **New Web Service**
2. Conecte o repositório GitHub `lastore-api`
3. Configure:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Region:** Ohio (US East — mais próximo do Brasil)
4. Em **Environment Variables**, adicione todas as variáveis do `.env.example`
5. Clique em **Create Web Service**

O Render dará uma URL como `https://lastore-api.onrender.com`

### 2.3 Rodar o seed (dados iniciais)
```bash
# Com as variáveis de ambiente configuradas:
cd backend
cp .env.example .env
# Preencha o .env com os valores reais
npm install
node src/config/seed.js
```

---

## 3. Frontend — Netlify

### 3.1 Atualizar a URL da API
Em **todos os arquivos HTML** do frontend, substitua:
```
https://lastore-api.onrender.com/api
```
pela URL real do Render.

Ou centralize em um arquivo de configuração — abra qualquer HTML e mude a linha:
```html
<script>window.L.A. STORE_API_URL = 'https://lastore-api.onrender.com/api';</script>
```

### 3.2 Deploy
**Netlify (mais simples):**
1. Acesse [netlify.com](https://netlify.com)
2. Arraste a pasta `frontend/` para a área de deploy
3. Pronto — ficará online em ~30 segundos

**Ou via Git:**
```bash
cd frontend
# Conecte ao GitHub, depois no Netlify:
# Build command: (vazio — é HTML estático)
# Publish directory: /
```

**Vercel:**
```bash
npm i -g vercel
cd frontend
vercel --prod
```

---

## 4. Configurações pós-deploy

### 4.1 Mercado Pago
1. Acesse [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers)
2. Crie um app e obtenha o `Access Token` de produção
3. Configure o webhook para: `https://lastore-api.onrender.com/api/payment/mp/webhook`

### 4.2 E-mail (Resend — recomendado)
1. Crie conta em [resend.com](https://resend.com)
2. Adicione seu domínio e verifique via DNS
3. Gere uma API Key
4. Configure no `.env`:
   ```
   MAIL_HOST=smtp.resend.com
   MAIL_PORT=465
   MAIL_USER=resend
   MAIL_PASS=re_sua_chave
   MAIL_FROM=L.A. STORE <noreply@seudominio.com.br>
   ```
5. Para testar o envio (ex: notificação de retorno ao estoque), zere o estoque de um produto tipo "Em Estoque", cadastre uma notificação pela página do produto e depois atualize o estoque para um valor positivo pelo painel admin — o e-mail é disparado automaticamente.

### 4.3 Número de WhatsApp
Em todos os arquivos HTML, substitua `5511999999999` pelo seu número real (com código do país, sem + e sem espaços).

### 4.4 Domínio personalizado
- **Netlify:** Settings → Domain Management → Add custom domain
- **Render:** Settings → Custom Domain

---

## 5. Cupons pré-configurados

| Código | Desconto | Mínimo |
|--------|----------|--------|
| `L.A. STORE10` | 10% | Sem mínimo |
| `L.A. STORE15` | 15% | R$ 300 |
| `BEMVINDO`   | 5%  | Sem mínimo |
| `FRETEGRATIS`| R$ 25 fixo | R$ 200 |

---

## 6. Rotas da API

### Públicas
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET`  | `/health` | Status da API |
| `POST` | `/api/auth/register` | Cadastro |
| `POST` | `/api/auth/login` | Login |
| `GET`  | `/api/products` | Listar produtos |
| `GET`  | `/api/products/:slug` | Detalhe do produto |
| `GET`  | `/api/products/categories` | Categorias |
| `POST` | `/api/coupons/validate` | Validar cupom |
| `POST` | `/api/newsletter` | Assinar newsletter |
| `POST` | `/api/contact` | Formulário de contato |
| `GET`  | `/api/payment/shipping/:cep` | Calcular frete |
| `POST` | `/api/orders` | Criar pedido |

### Autenticadas (token JWT)
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET`  | `/api/auth/me` | Dados do usuário |
| `PUT`  | `/api/auth/profile` | Editar perfil |
| `GET`  | `/api/orders/mine` | Meus pedidos |
| `GET`  | `/api/addresses` | Meus endereços |
| `POST` | `/api/addresses` | Novo endereço |

### Admin (role: admin)
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET`  | `/api/admin/metrics` | Dashboard |
| `GET`  | `/api/admin/clients` | Lista de clientes |
| `GET`  | `/api/orders` | Todos os pedidos |
| `PATCH`| `/api/orders/:id/status` | Atualizar status |
| `POST` | `/api/products` | Criar produto |
| `PUT`  | `/api/products/:id` | Editar produto |
| `GET`  | `/api/coupons` | Listar cupons |
| `POST` | `/api/coupons` | Criar cupom |

---

## 7. Acesso admin

Após rodar o seed, acesse `/pages/admin.html` com:
- **E-mail:** valor de `ADMIN_EMAIL` no `.env`
- **Senha:** valor de `ADMIN_PASSWORD` no `.env`

---

**L.A. STORE** — Feito com cuidado, pensado com intenção.
