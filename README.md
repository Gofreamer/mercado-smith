# Global Smith

Marketplace premium corporativo para RPG.

## Stack
- HTML + CSS + JS vanilla (modular)
- Firebase Authentication (Email/Password)
- Firebase Realtime Database

## Estrutura

```
global-smith/
├── index.html
├── css/styles.css
├── js/
│   ├── config/firebase-config.js
│   ├── data/state.js
│   ├── core/utils.js
│   ├── services/
│   │   ├── auth.js
│   │   └── database.js
│   ├── app/
│   │   ├── auth-ui.js
│   │   ├── navigation.js
│   │   └── start.js
│   └── features/
│       ├── market/market.js
│       ├── inventory/inventory.js
│       ├── profile/profile.js
│       └── admin/admin.js
└── database.rules.json
```

## Como rodar localmente

1. Configure o Firebase (já feito)
2. Coloque as regras abertas no Realtime Database
3. Abra o `index.html` com um servidor local (Live Server, ou `npx serve`)

Ou suba no Cloudflare Pages.

## Primeiro uso

1. Crie uma conta pelo site
2. Copie o UID que aparece no Perfil
3. No Firebase → Realtime Database → users → seu UID → mude `isAdmin` para `true`
4. Recarregue a página → o menu **Admin** aparece

## Saldo inicial
Todo personagem novo começa com **$ 1.000,00**
