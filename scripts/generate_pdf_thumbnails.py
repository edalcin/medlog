#!/usr/bin/env python3
"""
Script para gerar thumbnails de PDFs já existentes no MedLog.
Execute na pasta /mnt/user/Storage/appsdata/medlog/ do Unraid ou Windows.

Requisitos:
  pip install pdf2image pillow pymysql

Uso:
  python3 generate_pdf_thumbnails.py

ou especifique o caminho da pasta:
  python3 generate_pdf_thumbnails.py /caminho/para/medlog
"""

import os
import sys
from pathlib import Path
from io import BytesIO
import pymysql
import uuid
from datetime import datetime

try:
    from pdf2image import convert_from_path
    HAS_PDF2IMAGE = True
except ImportError:
    HAS_PDF2IMAGE = False

try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

# Determinar diretório de uploads
if len(sys.argv) > 1:
    UPLOADS_DIR = sys.argv[1]
else:
    UPLOADS_DIR = os.getcwd()

THUMBNAILS_DIR = os.path.join(UPLOADS_DIR, "thumbnails")
THUMBNAIL_SIZE = (200, 200)

# Configuração do banco de dados - ATUALIZE COM SUAS CREDENCIAIS
DB_CONFIG = {
    'host': '192.168.1.10',  # Mude se necessário
    'user': 'medlog',
    'password': 'medlog',  # Adicione a senha do banco
    'database': 'medlog',
    'port': 3333,
}

def setup_directories():
    """Cria os diretórios necessários."""
    os.makedirs(THUMBNAILS_DIR, exist_ok=True)
    print(f"✓ Diretório de thumbnails criado/verificado: {THUMBNAILS_DIR}")

def get_db_connection():
    """Estabelece conexão com o banco de dados."""
    try:
        conn = pymysql.connect(**DB_CONFIG)
        print("✓ Conectado ao banco de dados com sucesso")
        return conn
    except pymysql.Error as e:
        print(f"✗ Erro ao conectar ao banco de dados: {e}")
        print("\nVerifique:")
        print("  1. Se o banco de dados está rodando")
        print("  2. Se o host/user/password estão corretos")
        print("  3. Se está em /mnt/user/Storage/appsdata/medlog/")
        sys.exit(1)

def get_pdfs_without_thumbnails(conn):
    """Busca PDFs que ainda não têm thumbnail."""
    cursor = conn.cursor(pymysql.cursors.DictCursor)
    query = """
        SELECT id, path, filename
        FROM files
        WHERE mimeType = 'application/pdf'
        AND (thumbnailPath IS NULL OR thumbnailPath = '')
        ORDER BY uploadedAt ASC
    """
    cursor.execute(query)
    results = cursor.fetchall()
    cursor.close()
    return results

def generate_thumbnail_with_pymupdf(pdf_path):
    """Gera thumbnail usando PyMuPDF (sem dependência de poppler)."""
    try:
        from PIL import Image

        if not os.path.exists(pdf_path):
            return None

        doc = fitz.open(pdf_path)
        if len(doc) == 0:
            return None

        # Renderizar primeira página em alta resolução
        page = doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)

        # Converter para imagem PIL
        img_data = pix.tobytes("ppm")
        image = Image.open(BytesIO(img_data))

        # Redimensionar
        image.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

        # Salvar
        thumbnail_filename = f"{uuid.uuid4()}.png"
        thumbnail_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
        image.save(thumbnail_path, "PNG")

        doc.close()
        return thumbnail_filename

    except Exception as e:
        print(f"  ✗ Erro PyMuPDF: {e}")
        return None

def generate_thumbnail_with_pdf2image(pdf_path):
    """Gera thumbnail usando pdf2image (requer poppler)."""
    try:
        from PIL import Image

        if not os.path.exists(pdf_path):
            return None

        images = convert_from_path(pdf_path, first_page=1, last_page=1, dpi=100)

        if not images:
            return None

        image = images[0]
        image.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

        thumbnail_filename = f"{uuid.uuid4()}.png"
        thumbnail_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
        image.save(thumbnail_path, "PNG")

        return thumbnail_filename

    except Exception as e:
        print(f"  ✗ Erro pdf2image: {e}")
        return None

def generate_thumbnail(pdf_path):
    """
    Gera thumbnail da primeira página do PDF.
    Tenta PyMuPDF primeiro, depois pdf2image.
    """
    try:
        # Tentar PyMuPDF primeiro (não precisa poppler)
        if HAS_PYMUPDF:
            result = generate_thumbnail_with_pymupdf(pdf_path)
            if result:
                print(f"  ✓ Thumbnail gerado: {result}")
                return result

        # Fallback para pdf2image
        if HAS_PDF2IMAGE:
            result = generate_thumbnail_with_pdf2image(pdf_path)
            if result:
                print(f"  ✓ Thumbnail gerado: {result}")
                return result

        print(f"  ✗ Nenhuma biblioteca disponível para converter PDF")
        return None

    except Exception as e:
        print(f"  ✗ Erro ao gerar thumbnail: {e}")
        return None

def update_thumbnail_path(conn, file_id, thumbnail_path):
    """Atualiza o caminho do thumbnail no banco de dados."""
    cursor = conn.cursor()
    query = """
        UPDATE files
        SET thumbnailPath = %s
        WHERE id = %s
    """
    cursor.execute(query, (thumbnail_path, file_id))
    conn.commit()
    cursor.close()

def main():
    print("=" * 60)
    print("MedLog - Gerador de Thumbnails de PDF")
    print("=" * 60)
    print()

    print(f"📁 Diretório de PDFs: {os.path.abspath(UPLOADS_DIR)}")
    print(f"📁 Diretório de thumbnails: {os.path.abspath(THUMBNAILS_DIR)}")
    print()

    print()

    # Criar diretórios
    setup_directories()
    print()

    # Conectar ao banco de dados
    print("Conectando ao banco de dados...")
    conn = get_db_connection()
    print()

    # Buscar PDFs sem thumbnail
    print("Buscando PDFs sem thumbnail...")
    pdfs = get_pdfs_without_thumbnails(conn)

    if not pdfs:
        print("✓ Nenhum PDF sem thumbnail encontrado!")
        conn.close()
        return

    print(f"✓ Encontrado(s) {len(pdfs)} PDF(s) sem thumbnail")
    print()

    # Importar Image aqui para usar PIL
    try:
        from PIL import Image
    except ImportError:
        print("✗ Pillow não está instalado!")
        print("  Execute: pip install pillow")
        sys.exit(1)

    # Processar cada PDF
    processed = 0
    failed = 0

    print("Processando PDFs...")
    print("-" * 60)

    for idx, pdf in enumerate(pdfs, 1):
        file_id = pdf['id']
        pdf_path = os.path.join(UPLOADS_DIR, pdf['path'])
        filename = pdf['filename']

        print(f"[{idx}/{len(pdfs)}] {filename}")

        # Gerar thumbnail
        thumbnail_path = generate_thumbnail(pdf_path)

        if thumbnail_path:
            # Atualizar banco de dados
            try:
                update_thumbnail_path(conn, file_id, thumbnail_path)
                processed += 1
            except Exception as e:
                print(f"  ✗ Erro ao atualizar banco: {e}")
                failed += 1
        else:
            failed += 1

    print("-" * 60)
    print()

    # Resumo final
    print("=" * 60)
    print("RESUMO")
    print("=" * 60)
    print(f"✓ Processados com sucesso: {processed}")
    print(f"✗ Falharam: {failed}")
    print(f"  Total: {len(pdfs)}")
    print()

    conn.close()

    if failed == 0:
        print("✓ Todos os thumbnails foram gerados com sucesso!")
    else:
        print("⚠ Alguns thumbnails não puderam ser gerados. Verifique os erros acima.")

if __name__ == "__main__":
    main()
