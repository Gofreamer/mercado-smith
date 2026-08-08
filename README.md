# Global Smith

Marketplace premium in-world para RPG.

## Funcionalidades

- Autenticação (e-mail / senha)
- Mercado com busca, chips de categorias e ordenação
- Modal de detalhe do produto
- Carrinho (drawer, quantidade, persistência local)
- Compra rápida ou checkout com confirmação
- **Sistema de entrega**: status + mensagem in-world visível no card do pedido
- Inventário e histórico de pedidos com status
- Perfil + saldo
- Lista de desejos com aviso quando item volta ao estoque
- **Negociação** (Platina+): chat curto + oferta/contra
- **Eventos temporários** (ex. Semana Nina Riders): tag, banner, desconto opcional
- Empty states com copy in-world
- **Admin completo**
  - CRUD de produtos (inclui dias de entrega)
  - Gestão de pedidos (marcar entregue, editar data)
  - Negociações / ofertas
  - Eventos temporários
  - Ajuste de saldo
- Header responsivo (menu mobile)
- Hero só na aba Mercado

## Stack

HTML + CSS + JS vanilla · Firebase Auth · Realtime Database

## Como rodar

```bash
npx serve .
```

## Contas (player + admin)

Firebase Auth → **E-mail/senha** (ativar no console).

Sugestão de e-mails fictícios (qualquer formato `*@*` vale):

| Papel  | E-mail exemplo            | Senha (sua) |
|--------|---------------------------|-------------|
| Admin  | `admin@globalsmith.rpg`   | …           |
| Player | `player@globalsmith.rpg`  | …           |

### Passo a passo

1. **Console Firebase** → Authentication → Sign-in method → **E-mail/senha** → Ativar  
2. No site, **Criar conta** com o e-mail admin (e outra com o player)  
3. Login como admin → **Perfil** → copie o **UID**  
4. Console → Realtime Database → `users` → `{UID_ADMIN}` → adicione:
   - `isAdmin`: `true` (boolean)
5. Recarregue o site (F5) → menu **Admin** aparece  
6. **Rules**: cole o conteúdo de `database.rules.json` em  
   Realtime Database → Rules → Publish  

> O player **não** consegue se promover a admin pelas rules (`isAdmin` só admin grava).

### Admin sem UID no código

O app lê `users/{uid}/isAdmin === true`.  
`ADMIN_UIDS` em `js/data/state.js` é só fallback opcional.

## Entrega
## Entrega

- No produto: campo **Dias para entrega** (0 = imediata)  
- Na compra: pedido e inventário ficam `in_transit` ou `delivered`  
- Admin → aba **Pedidos / Entregas**: marcar entregue ou mudar a data

## Saldo inicial

$ 1.000,00
