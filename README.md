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

## Admin

1. Crie conta → copie o UID no Perfil  
2. Firebase → `users/{UID}/isAdmin = true`  
3. Recarregue → menu Admin

## Entrega

- No produto: campo **Dias para entrega** (0 = imediata)  
- Na compra: pedido e inventário ficam `in_transit` ou `delivered`  
- Admin → aba **Pedidos / Entregas**: marcar entregue ou mudar a data

## Saldo inicial

$ 1.000,00
