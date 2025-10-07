from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class HealthcareProfessional(db.Model):
    __tablename__ = 'healthcare_professionals'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    specialty = db.Column(db.String(100), nullable=False)
    crm = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    address = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    consultations = db.relationship('Consultation', backref='professional', lazy=True)
    
    def __repr__(self):
        return f'<HealthcareProfessional {self.name}>'

class Consultation(db.Model):
    __tablename__ = 'consultations'
    
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    professional_id = db.Column(db.Integer, db.ForeignKey('healthcare_professionals.id'), nullable=False)
    specialty = db.Column(db.String(100), nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    files = db.relationship('ConsultationFile', backref='consultation', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Consultation {self.id} - {self.date}>'

class ConsultationFile(db.Model):
    __tablename__ = 'consultation_files'
    
    id = db.Column(db.Integer, primary_key=True)
    consultation_id = db.Column(db.Integer, db.ForeignKey('consultations.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50))
    description = db.Column(db.String(200))
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<ConsultationFile {self.original_filename}>'
