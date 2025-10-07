import os
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, flash, send_from_directory
from werkzeug.utils import secure_filename
from config import Config
from models import db, HealthcareProfessional, Consultation, ConsultationFile

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/')
def index():
    consultations = Consultation.query.order_by(Consultation.date.desc()).all()
    return render_template('index.html', consultations=consultations)

# Healthcare Professional routes
@app.route('/professionals')
def professionals():
    professionals = HealthcareProfessional.query.order_by(HealthcareProfessional.name).all()
    return render_template('professionals.html', professionals=professionals)

@app.route('/professionals/new', methods=['GET', 'POST'])
def new_professional():
    if request.method == 'POST':
        professional = HealthcareProfessional(
            name=request.form['name'],
            specialty=request.form['specialty'],
            crm=request.form.get('crm', ''),
            phone=request.form.get('phone', ''),
            address=request.form.get('address', '')
        )
        db.session.add(professional)
        db.session.commit()
        flash('Profissional de saúde cadastrado com sucesso!', 'success')
        return redirect(url_for('professionals'))
    return render_template('professional_form.html')

@app.route('/professionals/<int:id>/edit', methods=['GET', 'POST'])
def edit_professional(id):
    professional = HealthcareProfessional.query.get_or_404(id)
    if request.method == 'POST':
        professional.name = request.form['name']
        professional.specialty = request.form['specialty']
        professional.crm = request.form.get('crm', '')
        professional.phone = request.form.get('phone', '')
        professional.address = request.form.get('address', '')
        db.session.commit()
        flash('Profissional de saúde atualizado com sucesso!', 'success')
        return redirect(url_for('professionals'))
    return render_template('professional_form.html', professional=professional)

@app.route('/professionals/<int:id>/delete', methods=['POST'])
def delete_professional(id):
    professional = HealthcareProfessional.query.get_or_404(id)
    db.session.delete(professional)
    db.session.commit()
    flash('Profissional de saúde removido com sucesso!', 'success')
    return redirect(url_for('professionals'))

# Consultation routes
@app.route('/consultations/new', methods=['GET', 'POST'])
def new_consultation():
    professionals = HealthcareProfessional.query.order_by(HealthcareProfessional.name).all()
    if request.method == 'POST':
        date_str = request.form['date']
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        consultation = Consultation(
            date=date,
            professional_id=request.form['professional_id'],
            specialty=request.form['specialty'],
            notes=request.form.get('notes', '')
        )
        db.session.add(consultation)
        db.session.commit()
        
        # Handle file uploads
        if 'files' in request.files:
            files = request.files.getlist('files')
            for file in files:
                if file and file.filename and allowed_file(file.filename):
                    original_filename = secure_filename(file.filename)
                    filename = f"{consultation.id}_{datetime.now().timestamp()}_{original_filename}"
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    file.save(file_path)
                    
                    consultation_file = ConsultationFile(
                        consultation_id=consultation.id,
                        filename=filename,
                        original_filename=original_filename,
                        file_type=file.content_type
                    )
                    db.session.add(consultation_file)
            db.session.commit()
        
        flash('Consulta registrada com sucesso!', 'success')
        return redirect(url_for('index'))
    return render_template('consultation_form.html', professionals=professionals)

@app.route('/consultations/<int:id>')
def view_consultation(id):
    consultation = Consultation.query.get_or_404(id)
    return render_template('consultation_detail.html', consultation=consultation)

@app.route('/consultations/<int:id>/edit', methods=['GET', 'POST'])
def edit_consultation(id):
    consultation = Consultation.query.get_or_404(id)
    professionals = HealthcareProfessional.query.order_by(HealthcareProfessional.name).all()
    
    if request.method == 'POST':
        date_str = request.form['date']
        consultation.date = datetime.strptime(date_str, '%Y-%m-%d').date()
        consultation.professional_id = request.form['professional_id']
        consultation.specialty = request.form['specialty']
        consultation.notes = request.form.get('notes', '')
        
        # Handle file uploads
        if 'files' in request.files:
            files = request.files.getlist('files')
            for file in files:
                if file and file.filename and allowed_file(file.filename):
                    original_filename = secure_filename(file.filename)
                    filename = f"{consultation.id}_{datetime.now().timestamp()}_{original_filename}"
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    file.save(file_path)
                    
                    consultation_file = ConsultationFile(
                        consultation_id=consultation.id,
                        filename=filename,
                        original_filename=original_filename,
                        file_type=file.content_type
                    )
                    db.session.add(consultation_file)
        
        db.session.commit()
        flash('Consulta atualizada com sucesso!', 'success')
        return redirect(url_for('view_consultation', id=id))
    return render_template('consultation_form.html', consultation=consultation, professionals=professionals)

@app.route('/consultations/<int:id>/delete', methods=['POST'])
def delete_consultation(id):
    consultation = Consultation.query.get_or_404(id)
    
    # Delete associated files
    for file in consultation.files:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
    
    db.session.delete(consultation)
    db.session.commit()
    flash('Consulta removida com sucesso!', 'success')
    return redirect(url_for('index'))

@app.route('/files/<int:file_id>/delete', methods=['POST'])
def delete_file(file_id):
    file = ConsultationFile.query.get_or_404(file_id)
    consultation_id = file.consultation_id
    
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    db.session.delete(file)
    db.session.commit()
    flash('Arquivo removido com sucesso!', 'success')
    return redirect(url_for('view_consultation', id=consultation_id))

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.cli.command()
def init_db():
    """Initialize the database."""
    db.create_all()
    print('Database initialized.')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
