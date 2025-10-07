# MedLog - Sistema de Registro Médico

Sistema para registro de consultas médicas, resultados e laudos de exames e profissionais de saúde.

## Funcionalidades

- **Registro de Consultas Médicas**: Registre consultas com data, profissional, especialidade e notas em texto livre
- **Upload de Arquivos**: Anexe receitas, imagens de exames, resultados e laudos (PDF, PNG, JPG)
- **Gestão de Profissionais**: Cadastre profissionais de saúde com nome, especialidade, CRM, telefone e endereço
- **Visualização de Consultas**: Veja todas as consultas registradas com seus detalhes e arquivos anexados

## Tecnologias

- Python 3
- Flask (framework web)
- SQLAlchemy (ORM)
- SQLite (banco de dados)

## Instalação

1. Clone o repositório
2. Crie um ambiente virtual Python:
```bash
python -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate
```

3. Instale as dependências:
```bash
pip install -r requirements.txt
```

4. Execute a aplicação:
```bash
python app.py
```

5. Acesse no navegador: `http://localhost:5000`

## Uso

### Cadastrar Profissionais
1. Acesse "Profissionais" no menu
2. Clique em "Novo Profissional"
3. Preencha os dados e salve

### Registrar Consulta
1. Acesse "Consultas" no menu
2. Clique em "Nova Consulta"
3. Selecione a data, profissional e especialidade
4. Adicione observações em texto livre
5. Anexe arquivos (receitas, exames, laudos)
6. Salve a consulta

### Visualizar Consultas
- A página inicial mostra todas as consultas
- Clique em "Ver" para ver detalhes completos
- Clique em "Editar" para modificar
- Clique em "Excluir" para remover

## Estrutura do Projeto

```
medlog/
├── app.py              # Aplicação principal Flask
├── models.py           # Modelos do banco de dados
├── config.py           # Configurações
├── requirements.txt    # Dependências Python
├── templates/          # Templates HTML
│   ├── base.html
│   ├── index.html
│   ├── consultation_form.html
│   ├── consultation_detail.html
│   ├── professionals.html
│   └── professional_form.html
└── uploads/           # Arquivos enviados (criado automaticamente)
```