# Palavra Viva

Aplicativo web responsivo para preparar, organizar e consultar mensagens e estudos bíblicos.

## Primeira versão
- Painel inicial
- Cadastro, edição e busca de mensagens
- Editor manual de pregações
- Áreas preparadas para Bíblia, pastas e apresentações
- Interface adaptável para celular e computador

## Decisões do produto
- A pregação é escrita pelo usuário.
- Não há geração de esboços por IA.
- A geração de apresentações com IA poderá ser adicionada em uma etapa futura, somente a partir do conteúdo escrito pelo usuário.
- Integração com Holyrics será implementada posteriormente, após validar a API Server e o ambiente local da igreja.

## Desenvolvimento
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Observação
Esta primeira versão mantém as mensagens no estado local do navegador. Para acessar os mesmos dados em vários dispositivos, será necessário implementar autenticação e banco de dados na nuvem antes de publicar para uso real.
