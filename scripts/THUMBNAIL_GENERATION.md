# Geração de Thumbnails para PDFs Existentes

Este script gera thumbnails (miniaturas) para todos os PDFs já enviados ao MedLog que não possuem thumbnail.

## 📋 Pré-requisitos

1. **Acesso ao Unraid** via terminal/SSH
2. **Python 3.6+** instalado no Unraid
3. **pip** (gerenciador de pacotes Python)

## 🚀 Instalação de Dependências

Execute os seguintes comandos **antes de rodar o script**:

```bash
# Instalar dependências Python necessárias
pip install pdf2image pillow pymysql

# Para que pdf2image funcione, também é necessário:
# (geralmente já vem instalado no Unraid)
# apt-get install poppler-utils
```

## ⚙️ Configuração

Edite o arquivo `generate_pdf_thumbnails.py` e atualize a configuração do banco de dados:

```python
DB_CONFIG = {
    'host': 'localhost',        # IP/hostname do banco (mude se necessário)
    'user': 'medlog',           # Usuário do banco
    'password': '',             # ← ADICIONE A SENHA AQUI
    'database': 'medlog',       # Nome do banco
    'port': 3306,               # Porta (padrão: 3306)
}
```

**Onde encontrar as credenciais:**
- Verifique o arquivo `.env` ou configuração do container do MedLog
- A variável `DATABASE_URL` contém as informações de conexão

## 🏃 Como Executar

1. **Navegue até a pasta do MedLog:**
   ```bash
   cd /mnt/user/Storage/appsdata/medlog
   ```

2. **Execute o script:**
   ```bash
   python3 scripts/generate_pdf_thumbnails.py
   ```

## 📊 O que o script faz

1. ✓ Cria a subpasta `uploads/thumbnails/` se não existir
2. ✓ Conecta ao banco de dados
3. ✓ Busca todos os PDFs que ainda não têm thumbnail
4. ✓ Gera uma imagem PNG da primeira página de cada PDF
5. ✓ Redimensiona para 200x200 pixels
6. ✓ Atualiza o banco de dados com o caminho do thumbnail
7. ✓ Exibe um relatório final com sucesso/falhas

## 📝 Exemplo de Saída

```
============================================================
MedLog - Gerador de Thumbnails de PDF
============================================================

📁 Diretório de uploads: /mnt/user/Storage/appsdata/medlog/uploads

✓ Diretório de thumbnails criado/verificado: ./uploads/thumbnails
✓ Conectado ao banco de dados com sucesso

Buscando PDFs sem thumbnail...
✓ Encontrado(s) 5 PDF(s) sem thumbnail

Processando PDFs...
------------------------------------------------------------
[1/5] receita_janeiro.pdf
  ✓ Thumbnail gerado: a1b2c3d4-e5f6-7890-abcd-ef1234567890.png
[2/5] exame_sangue.pdf
  ✓ Thumbnail gerado: b2c3d4e5-f6a7-8901-bcde-f12345678901.png
...
------------------------------------------------------------

============================================================
RESUMO
============================================================
✓ Processados com sucesso: 5
✗ Falharam: 0
  Total: 5

✓ Todos os thumbnails foram gerados com sucesso!
```

## 🐛 Troubleshooting

### Erro: "Diretório './uploads' não encontrado"
- Certifique-se de estar em `/mnt/user/Storage/appsdata/medlog/`

### Erro: "Falha ao conectar ao banco de dados"
- Verifique se o banco de dados está rodando
- Verifique as credenciais em `DB_CONFIG`
- Verifique se a porta 3306 está acessível

### Erro: "pdf2image not found"
- Execute: `pip install pdf2image`
- No Unraid, pode ser necessário: `apt-get install poppler-utils`

### Erro: "Module named 'PIL' not found"
- Execute: `pip install pillow`

### Script demora muito
- Se tiver muitos PDFs (>100), é normal demorar alguns minutos
- Você pode ver o progresso em tempo real conforme o script executa

## ✅ Validação

Após executar o script:

1. Acesse a página de arquivos em `https://medlog.dalc.in/files`
2. Você deverá ver thumbnails dos PDFs na listagem e no modal de detalhes
3. Se um PDF ainda não tiver thumbnail, pode ser que tenha falhado na geração (verifique logs)

## 📌 Notas

- Os thumbnails são armazenados em `uploads/thumbnails/` com nomes aleatórios (UUIDs)
- Cada thumbnail é uma imagem PNG de 200x200 pixels
- O script é seguro - apenas lê PDFs e atualiza registros no banco
- Pode ser executado múltiplas vezes com segurança (não recria thumbnails já existentes)

## 🔄 Uso Futuro

Após isto, **novos PDFs enviados automaticamente terão thumbnails** gerados durante o upload.

Este script só é necessário uma única vez para processar PDFs já existentes.
