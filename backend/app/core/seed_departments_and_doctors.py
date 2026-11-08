"""
Seeder for the 28 Hospital Departments, Complete Doctor Directory, Shift Schedules, and Patient Reviews.
Ensures comprehensive clinical demonstration data conforms to professional hospital standards.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List
import structlog
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.doctor_schedule import DoctorSchedule, DayOfWeek
from app.models.doctor_review import DoctorReview
from app.models.enterprise_provider import Department
from app.models.patient import Patient

log = structlog.get_logger(__name__)

DEPARTMENTS_CATALOG = [
    {
        "name": "Cardiology",
        "code": "CARD",
        "description": "Comprehensive cardiovascular care, ECG reviews, cardiac catheterization, and hypertension management.",
        "icon": "HeartPulse",
        "location": "North Pavilion, Floor 4",
        "phone": "(555) 019-2831",
        "email": "cardiology@medicare.ai",
        "head": "Dr. Sarah Chen, MD, FACC",
    },
    {
        "name": "Dermatology",
        "code": "DERM",
        "description": "Advanced clinical skincare, acne therapy, eczema, mole screening, and dermatosurgical care.",
        "icon": "Sparkles",
        "location": "West Wing, Floor 2",
        "phone": "(555) 019-2832",
        "email": "dermatology@medicare.ai",
        "head": "Dr. Maya Patel, MD, FAAD",
    },
    {
        "name": "Neurology",
        "code": "NEUR",
        "description": "Specialized diagnosis for migraines, neuropathy, stroke recovery, and neuromuscular disorders.",
        "icon": "Brain",
        "location": "North Pavilion, Floor 5",
        "phone": "(555) 019-2833",
        "email": "neurology@medicare.ai",
        "head": "Dr. Elena Rostova, MD, PhD",
    },
    {
        "name": "Endocrinology",
        "code": "ENDO",
        "description": "Hormonal balance, thyroid disorders, continuous glucose monitoring, and personalized diabetes therapy.",
        "icon": "Activity",
        "location": "West Wing, Floor 3",
        "phone": "(555) 019-2834",
        "email": "endocrinology@medicare.ai",
        "head": "Dr. James Kim, MD",
    },
    {
        "name": "General Practice",
        "code": "GP",
        "description": "Holistic family medicine, preventive wellness examinations, routine physicals, and health screening.",
        "icon": "Stethoscope",
        "location": "East Pavilion, Clinic 2A",
        "phone": "(555) 019-2835",
        "email": "generalpractice@medicare.ai",
        "head": "Dr. Maria Lopez, MD",
    },
    {
        "name": "Pediatrics",
        "code": "PED",
        "description": "Compassionate developmental and clinical healthcare for newborns, infants, children, and teens.",
        "icon": "Baby",
        "location": "Children's Health Pavilion, Floor 1",
        "phone": "(555) 019-2836",
        "email": "pediatrics@medicare.ai",
        "head": "Dr. Lucas Evans, MD, FAAP",
    },
    {
        "name": "Orthopedics",
        "code": "ORTHO",
        "description": "Bone, joint, fracture, sports medicine rehabilitation, joint replacements, and spine surgery.",
        "icon": "Bone",
        "location": "Surgical Tower, Floor 3",
        "phone": "(555) 019-2837",
        "email": "orthopedics@medicare.ai",
        "head": "Dr. David Sterling, MD, FAAOS",
    },
    {
        "name": "Gynecology",
        "code": "GYN",
        "description": "Comprehensive women's reproductive health, pelvic wellness, and routine gynecological screenings.",
        "icon": "Shield",
        "location": "Women's Health Pavilion, Floor 2",
        "phone": "(555) 019-2838",
        "email": "gynecology@medicare.ai",
        "head": "Dr. Rachel Green, MD, FACOG",
    },
    {
        "name": "Obstetrics",
        "code": "OBS",
        "description": "Compassionate prenatal monitoring, high-risk pregnancy care, labor and delivery, and postnatal support.",
        "icon": "Heart",
        "location": "Maternity Center, Floor 3",
        "phone": "(555) 019-2839",
        "email": "obstetrics@medicare.ai",
        "head": "Dr. Chloe Martin, MD",
    },
    {
        "name": "Pulmonology",
        "code": "PULM",
        "description": "Asthma, COPD, chronic cough, sleep apnea, and pulmonary diagnostic lung function evaluations.",
        "icon": "Wind",
        "location": "North Pavilion, Floor 5",
        "phone": "(555) 019-2840",
        "email": "pulmonology@medicare.ai",
        "head": "Dr. Alex Taylor, MD, FCCP",
    },
    {
        "name": "Gastroenterology",
        "code": "GASTRO",
        "description": "Digestive health, liver diagnostics, endoscopy, colonoscopy, GERD, and inflammatory bowel disease.",
        "icon": "Apple",
        "location": "Diagnostic Pavilion, Floor 2",
        "phone": "(555) 019-2841",
        "email": "gastroenterology@medicare.ai",
        "head": "Dr. Daniel Wu, MD, FACG",
    },
    {
        "name": "Oncology",
        "code": "ONCO",
        "description": "Compassionate cancer screening, medical oncology, targeted immunotherapy, and survivorship therapy.",
        "icon": "Award",
        "location": "Cancer Institute, Floor 4",
        "phone": "(555) 019-2842",
        "email": "oncology@medicare.ai",
        "head": "Dr. Victoria Sterling, MD",
    },
    {
        "name": "Nephrology",
        "code": "NEPH",
        "description": "Kidney disease management, electrolyte disorders, dialysis therapy, and renal hypertension care.",
        "icon": "Droplets",
        "location": "North Tower, Floor 3",
        "phone": "(555) 019-2843",
        "email": "nephrology@medicare.ai",
        "head": "Dr. Samuel Wright, MD",
    },
    {
        "name": "Urology",
        "code": "UROL",
        "description": "Urinary tract health, bladder wellness, kidney stone prevention, and specialized urological care.",
        "icon": "Compass",
        "location": "Surgical Tower, Floor 2",
        "phone": "(555) 019-2844",
        "email": "urology@medicare.ai",
        "head": "Dr. Nathan Cole, MD",
    },
    {
        "name": "Ophthalmology",
        "code": "OPHTH",
        "description": "Comprehensive vision assessments, glaucoma management, cataract evaluations, and retinal health.",
        "icon": "Eye",
        "location": "Eye & Vision Pavilion, Floor 1",
        "phone": "(555) 019-2845",
        "email": "ophthalmology@medicare.ai",
        "head": "Dr. Grace Lin, MD",
    },
    {
        "name": "ENT (Ear, Nose & Throat)",
        "code": "ENT",
        "description": "Sinusitis, hearing disorders, voice pathology, chronic tonsillitis, and head & neck surgery.",
        "icon": "Ear",
        "location": "Sensory Health Suite, Floor 2",
        "phone": "(555) 019-2846",
        "email": "ent@medicare.ai",
        "head": "Dr. Ethan Brooks, MD, FACS",
    },
    {
        "name": "Psychiatry",
        "code": "PSYCH",
        "description": "Evidence-based mental healthcare, mood disorders, depression, anxiety, and psychopharmacology.",
        "icon": "Smile",
        "location": "Behavioral Health Wing, Floor 4",
        "phone": "(555) 019-2847",
        "email": "psychiatry@medicare.ai",
        "head": "Dr. Julian Ross, MD",
    },
    {
        "name": "Psychology",
        "code": "PSYC",
        "description": "Cognitive behavioral therapy, clinical counseling, stress reduction, and psychological resilience.",
        "icon": "MessageSquare",
        "location": "Behavioral Health Wing, Floor 3",
        "phone": "(555) 019-2848",
        "email": "psychology@medicare.ai",
        "head": "Dr. Hannah Bailey, PsyD",
    },
    {
        "name": "Dentistry",
        "code": "DENT",
        "description": "Preventive oral hygiene, dental cleanings, restorative treatments, teeth alignment, and cosmetic care.",
        "icon": "CheckCircle",
        "location": "Dental Health Clinic, Floor 1",
        "phone": "(555) 019-2849",
        "email": "dentistry@medicare.ai",
        "head": "Dr. Brian Zhao, DDS",
    },
    {
        "name": "Rheumatology",
        "code": "RHEUM",
        "description": "Arthritis, lupus, gout, autoimmune disorders, and chronic inflammatory joint disease therapy.",
        "icon": "ShieldAlert",
        "location": "North Tower, Floor 2",
        "phone": "(555) 019-2850",
        "email": "rheumatology@medicare.ai",
        "head": "Dr. Jessica Hayes, MD, FACR",
    },
    {
        "name": "Hematology",
        "code": "HEM",
        "description": "Anemia, bleeding disorders, thrombosis, platelet variations, and comprehensive blood biochemistry.",
        "icon": "Droplet",
        "location": "Diagnostic Pavilion, Floor 3",
        "phone": "(555) 019-2851",
        "email": "hematology@medicare.ai",
        "head": "Dr. Marcus Thorne, MD",
    },
    {
        "name": "Infectious Diseases",
        "code": "INFECT",
        "description": "Management of acute and chronic bacterial, viral, fungal, and tropical travel-related infections.",
        "icon": "Bug",
        "location": "Specialty Care Wing, Floor 3",
        "phone": "(555) 019-2852",
        "email": "infectious@medicare.ai",
        "head": "Dr. Priya Sharma, MD",
    },
    {
        "name": "Allergy & Immunology",
        "code": "ALLERG",
        "description": "Comprehensive allergy testing, environmental desensitization, food allergies, and immunotherapy.",
        "icon": "ShieldPlus",
        "location": "Specialty Care Wing, Floor 2",
        "phone": "(555) 019-2853",
        "email": "allergy@medicare.ai",
        "head": "Dr. Robert Vance, MD",
    },
    {
        "name": "Radiology",
        "code": "RAD",
        "description": "Diagnostic and interventional imaging: 3T MRI, CT scans, ultrasound, mammography, and digital X-rays.",
        "icon": "Camera",
        "location": "Imaging Center, Ground Floor",
        "phone": "(555) 019-2854",
        "email": "radiology@medicare.ai",
        "head": "Dr. Aaron Miller, MD",
    },
    {
        "name": "Physiotherapy",
        "code": "PHYSIO",
        "description": "Physical therapy, musculoskeletal rehabilitation, posture correction, and post-surgery recovery.",
        "icon": "Zap",
        "location": "Rehabilitation Pavilion, Floor 1",
        "phone": "(555) 019-2855",
        "email": "physiotherapy@medicare.ai",
        "head": "Dr. Emily Watson, DPT",
    },
    {
        "name": "Emergency Medicine",
        "code": "EMERG",
        "description": "24/7 Level 1 trauma resuscitation, acute emergency admissions, stroke response, and critical triage.",
        "icon": "Siren",
        "location": "Ground Level, Ambulance Pavilion A",
        "phone": "(555) 019-9911",
        "email": "emergency@medicare.ai",
        "head": "Dr. Jonathan Cross, MD, FACEP",
    },
    {
        "name": "Geriatrics",
        "code": "GERI",
        "description": "Comprehensive healthcare for aging adults, mobility enhancement, memory care, and polypharmacy reviews.",
        "icon": "Users",
        "location": "Senior Wellness Wing, Floor 2",
        "phone": "(555) 019-2856",
        "email": "geriatrics@medicare.ai",
        "head": "Dr. Margaret Ross, MD",
    },
    {
        "name": "Nutrition & Dietetics",
        "code": "NUTR",
        "description": "Clinical dietary therapy, diabetic meal planning, cardiovascular nutrition, and weight wellness.",
        "icon": "Utensils",
        "location": "Wellness Center, Floor 1",
        "phone": "(555) 019-2857",
        "email": "nutrition@medicare.ai",
        "head": "Dr. Evelyn Scott, MS, RD, CDN",
    },
]

# Comprehensive Doctors Profile Catalog across Specialties
DOCTORS_CATALOG = [
    {
        "email": "sarah.chen@medicare.ai",
        "name": "Dr. Sarah Chen, MD, FACC",
        "specialty": "Cardiology",
        "department": "Cardiology",
        "license": "MD-2024-99881",
        "location": "North Pavilion, Suite 401",
        "phone": "(555) 234-1101",
        "qualifications": "MBBS, MD (Cardiovascular Disease), FACC",
        "experience_years": 16,
        "consultation_fee": 160.0,
        "languages": "English, Mandarin",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.95,
        "review_count": 142,
        "bio": "Board-certified cardiologist specializing in preventive cardiology, hypertension titration, echocardiography, and coronary risk reduction.",
        "shifts": [
            (DayOfWeek.MONDAY, time(9, 0), time(17, 0), 30),
            (DayOfWeek.TUESDAY, time(9, 0), time(17, 0), 30),
            (DayOfWeek.WEDNESDAY, time(9, 0), time(17, 0), 30),
            (DayOfWeek.THURSDAY, time(9, 0), time(17, 0), 30),
            (DayOfWeek.FRIDAY, time(9, 0), time(13, 0), 30),
        ]
    },
    {
        "email": "james.kim@medicare.ai",
        "name": "Dr. James Kim, MD",
        "specialty": "Endocrinology",
        "department": "Endocrinology",
        "license": "MD-2024-99882",
        "location": "West Wing, Suite 310",
        "phone": "(555) 234-1102",
        "qualifications": "MD, Board Certified in Endocrinology & Metabolism",
        "experience_years": 14,
        "consultation_fee": 145.0,
        "languages": "English, Korean",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400",
        "rating": 4.88,
        "review_count": 98,
        "bio": "Endocrinologist focusing on Type 1 and Type 2 diabetes management, continuous glucose monitoring telemetry, and thyroid disease.",
        "shifts": [
            (DayOfWeek.MONDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.TUESDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.WEDNESDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.THURSDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.FRIDAY, time(8, 30), time(16, 30), 30),
        ]
    },
    {
        "email": "maria.lopez@medicare.ai",
        "name": "Dr. Maria Lopez, MD",
        "specialty": "General Practice",
        "department": "General Practice",
        "license": "MD-2024-99883",
        "location": "East Pavilion, Clinic 2A",
        "phone": "(555) 234-1103",
        "qualifications": "MD (Family Medicine), ABFM",
        "experience_years": 12,
        "consultation_fee": 110.0,
        "languages": "English, Spanish",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1594824813682-192e2101b7a2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.92,
        "review_count": 210,
        "bio": "Primary care physician dedicated to routine physicals, wellness screening, multi-morbid care coordination, and lifestyle medicine.",
        "shifts": [
            (DayOfWeek.MONDAY, time(8, 0), time(17, 0), 30),
            (DayOfWeek.TUESDAY, time(8, 0), time(17, 0), 30),
            (DayOfWeek.WEDNESDAY, time(8, 0), time(17, 0), 30),
            (DayOfWeek.THURSDAY, time(8, 0), time(17, 0), 30),
            (DayOfWeek.FRIDAY, time(8, 0), time(17, 0), 30),
            (DayOfWeek.SATURDAY, time(9, 0), time(13, 0), 30),
        ]
    },
    {
        "email": "alex.taylor@medicare.ai",
        "name": "Dr. Alex Taylor, MD, FCCP",
        "specialty": "Pulmonology",
        "department": "Pulmonology",
        "license": "MD-2024-99884",
        "location": "North Pavilion, Suite 505",
        "phone": "(555) 234-1104",
        "qualifications": "MD, FCCP (Pulmonary & Critical Care)",
        "experience_years": 18,
        "consultation_fee": 155.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400",
        "rating": 4.89,
        "review_count": 84,
        "bio": "Pulmonologist specializing in adult asthma, COPD, obstructive sleep apnea, and chronic respiratory diagnostics.",
        "shifts": [
            (DayOfWeek.TUESDAY, time(9, 0), time(16, 0), 30),
            (DayOfWeek.WEDNESDAY, time(9, 0), time(16, 0), 30),
            (DayOfWeek.THURSDAY, time(9, 0), time(16, 0), 30),
            (DayOfWeek.FRIDAY, time(9, 0), time(16, 0), 30),
            (DayOfWeek.SATURDAY, time(9, 0), time(13, 0), 30),
        ]
    },
    {
        "email": "elena.rostova@medicare.ai",
        "name": "Dr. Elena Rostova, MD, PhD",
        "specialty": "Neurology",
        "department": "Neurology",
        "license": "MD-2024-99885",
        "location": "North Pavilion, Suite 512",
        "phone": "(555) 234-1105",
        "qualifications": "MD, PhD (Clinical Neurosciences)",
        "experience_years": 15,
        "consultation_fee": 170.0,
        "languages": "English, Russian",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.96,
        "review_count": 115,
        "bio": "Neurologist and stroke specialist focusing on migraine management, peripheral neuropathies, memory health, and neuro-rehabilitation.",
        "shifts": [
            (DayOfWeek.MONDAY, time(10, 0), time(17, 0), 30),
            (DayOfWeek.WEDNESDAY, time(10, 0), time(17, 0), 30),
            (DayOfWeek.FRIDAY, time(10, 0), time(17, 0), 30),
        ]
    },
    {
        "email": "maya.patel@medicare.ai",
        "name": "Dr. Maya Patel, MD, FAAD",
        "specialty": "Dermatology",
        "department": "Dermatology",
        "license": "MD-2024-99886",
        "location": "West Wing, Suite 215",
        "phone": "(555) 234-1106",
        "qualifications": "MD, FAAD (American Academy of Dermatology)",
        "experience_years": 11,
        "consultation_fee": 135.0,
        "languages": "English, Hindi, Gujarati",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1594824813682-192e2101b7a2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.94,
        "review_count": 168,
        "bio": "Expert dermatologist specializing in acne management, eczema, dermatoscopy, psoriasis, and preventive mole mapping.",
        "shifts": [
            (DayOfWeek.MONDAY, time(9, 0), time(16, 30), 30),
            (DayOfWeek.TUESDAY, time(9, 0), time(16, 30), 30),
            (DayOfWeek.THURSDAY, time(9, 0), time(16, 30), 30),
            (DayOfWeek.FRIDAY, time(9, 0), time(15, 0), 30),
        ]
    },
    {
        "email": "lucas.evans@medicare.ai",
        "name": "Dr. Lucas Evans, MD, FAAP",
        "specialty": "Pediatrics",
        "department": "Pediatrics",
        "license": "MD-2024-99887",
        "location": "Children's Pavilion, Suite 104",
        "phone": "(555) 234-1107",
        "qualifications": "MD, FAAP (Fellow of the American Academy of Pediatrics)",
        "experience_years": 13,
        "consultation_fee": 115.0,
        "languages": "English, French",
        "hospital_affiliation": "MediCare Children's Pavilion",
        "avatar_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400",
        "rating": 4.97,
        "review_count": 182,
        "bio": "Pediatrician providing developmental assessments, infant immunization programs, pediatric asthma care, and childhood wellness examinations.",
        "shifts": [
            (DayOfWeek.MONDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.TUESDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.WEDNESDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.FRIDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.SATURDAY, time(9, 0), time(12, 30), 30),
        ]
    },
    {
        "email": "david.sterling@medicare.ai",
        "name": "Dr. David Sterling, MD, FAAOS",
        "specialty": "Orthopedics",
        "department": "Orthopedics",
        "license": "MD-2024-99888",
        "location": "Surgical Tower, Suite 302",
        "phone": "(555) 234-1108",
        "qualifications": "MD, FAAOS (Orthopedic Surgery & Sports Medicine)",
        "experience_years": 20,
        "consultation_fee": 175.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400",
        "rating": 4.91,
        "review_count": 130,
        "bio": "Orthopedic surgeon specializing in sports injuries, knee and hip arthroplasty, rotator cuff repair, and minimally invasive fracture care.",
        "shifts": [
            (DayOfWeek.TUESDAY, time(8, 0), time(16, 0), 30),
            (DayOfWeek.WEDNESDAY, time(8, 0), time(16, 0), 30),
            (DayOfWeek.THURSDAY, time(8, 0), time(16, 0), 30),
        ]
    },
    {
        "email": "rachel.green@medicare.ai",
        "name": "Dr. Rachel Green, MD, FACOG",
        "specialty": "Gynecology",
        "department": "Gynecology",
        "license": "MD-2024-99889",
        "location": "Women's Pavilion, Suite 205",
        "phone": "(555) 234-1109",
        "qualifications": "MD, FACOG (Obstetrics & Gynecology)",
        "experience_years": 14,
        "consultation_fee": 140.0,
        "languages": "English, Spanish",
        "hospital_affiliation": "MediCare Women's Pavilion",
        "avatar_url": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.93,
        "review_count": 155,
        "bio": "Board-certified gynecologist providing comprehensive wellness screening, PCOS therapy, endometriosis treatment, and menopause consultations.",
        "shifts": [
            (DayOfWeek.MONDAY, time(9, 0), time(17, 0), 30),
            (DayOfWeek.WEDNESDAY, time(9, 0), time(17, 0), 30),
            (DayOfWeek.THURSDAY, time(9, 0), time(17, 0), 30),
            (DayOfWeek.FRIDAY, time(9, 0), time(14, 0), 30),
        ]
    },
    {
        "email": "chloe.martin@medicare.ai",
        "name": "Dr. Chloe Martin, MD",
        "specialty": "Obstetrics",
        "department": "Obstetrics",
        "license": "MD-2024-99890",
        "location": "Maternity Center, Suite 301",
        "phone": "(555) 234-1110",
        "qualifications": "MD, Board Certified in Maternal-Fetal Care",
        "experience_years": 12,
        "consultation_fee": 150.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Maternity Center",
        "avatar_url": "https://images.unsplash.com/photo-1594824813682-192e2101b7a2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.98,
        "review_count": 172,
        "bio": "Obstetrician focusing on prenatal ultrasound, maternal nutrition, physiological labor, and high-risk pregnancy monitoring.",
        "shifts": [
            (DayOfWeek.TUESDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.WEDNESDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.THURSDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.FRIDAY, time(8, 30), time(16, 30), 30),
        ]
    },
    {
        "email": "daniel.wu@medicare.ai",
        "name": "Dr. Daniel Wu, MD, FACG",
        "specialty": "Gastroenterology",
        "department": "Gastroenterology",
        "license": "MD-2024-99891",
        "location": "Diagnostic Pavilion, Suite 210",
        "phone": "(555) 234-1111",
        "qualifications": "MD, FACG (Fellow of the American College of Gastroenterology)",
        "experience_years": 16,
        "consultation_fee": 160.0,
        "languages": "English, Mandarin",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400",
        "rating": 4.90,
        "review_count": 89,
        "bio": "Gastroenterologist with expertise in acid reflux (GERD), inflammatory bowel disease (Crohn's and Colitis), fatty liver disease, and screening colonoscopy.",
        "shifts": [
            (DayOfWeek.MONDAY, time(9, 0), time(16, 0), 30),
            (DayOfWeek.WEDNESDAY, time(9, 0), time(16, 0), 30),
            (DayOfWeek.FRIDAY, time(9, 0), time(16, 0), 30),
        ]
    },
    {
        "email": "victoria.sterling@medicare.ai",
        "name": "Dr. Victoria Sterling, MD",
        "specialty": "Oncology",
        "department": "Oncology",
        "license": "MD-2024-99892",
        "location": "Cancer Institute, Suite 405",
        "phone": "(555) 234-1112",
        "qualifications": "MD, Board Certified in Medical Oncology & Hematology",
        "experience_years": 19,
        "consultation_fee": 190.0,
        "languages": "English, German",
        "hospital_affiliation": "MediCare Comprehensive Cancer Institute",
        "avatar_url": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.97,
        "review_count": 112,
        "bio": "Medical oncologist dedicated to evidence-based cancer staging, targeted immunotherapies, genomic tumor profiling, and compassionate survivorship care.",
        "shifts": [
            (DayOfWeek.TUESDAY, time(9, 0), time(17, 0), 30),
            (DayOfWeek.THURSDAY, time(9, 0), time(17, 0), 30),
            (DayOfWeek.FRIDAY, time(9, 0), time(15, 0), 30),
        ]
    },
    {
        "email": "samuel.wright@medicare.ai",
        "name": "Dr. Samuel Wright, MD",
        "specialty": "Nephrology",
        "department": "Nephrology",
        "license": "MD-2024-99893",
        "location": "North Tower, Suite 308",
        "phone": "(555) 234-1113",
        "qualifications": "MD, FASN (Fellow of the American Society of Nephrology)",
        "experience_years": 15,
        "consultation_fee": 150.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400",
        "rating": 4.87,
        "review_count": 65,
        "bio": "Nephrologist treating chronic kidney disease, proteinuria, acute renal injury, refractory hypertension, and electrolyte abnormalities.",
        "shifts": [
            (DayOfWeek.MONDAY, time(9, 0), time(16, 0), 30),
            (DayOfWeek.WEDNESDAY, time(9, 0), time(16, 0), 30),
            (DayOfWeek.THURSDAY, time(9, 0), time(16, 0), 30),
        ]
    },
    {
        "email": "nathan.cole@medicare.ai",
        "name": "Dr. Nathan Cole, MD",
        "specialty": "Urology",
        "department": "Urology",
        "license": "MD-2024-99894",
        "location": "Surgical Tower, Suite 214",
        "phone": "(555) 234-1114",
        "qualifications": "MD, Board Certified Urologist (FAUA)",
        "experience_years": 13,
        "consultation_fee": 155.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400",
        "rating": 4.89,
        "review_count": 78,
        "bio": "Specialist in kidney stone management, benign prostatic hyperplasia, urinary incontinence, and minimally invasive robotic urological procedures.",
        "shifts": [
            (DayOfWeek.TUESDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.THURSDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.FRIDAY, time(8, 30), time(15, 0), 30),
        ]
    },
    {
        "email": "grace.lin@medicare.ai",
        "name": "Dr. Grace Lin, MD",
        "specialty": "Ophthalmology",
        "department": "Ophthalmology",
        "license": "MD-2024-99895",
        "location": "Vision Pavilion, Suite 102",
        "phone": "(555) 234-1115",
        "qualifications": "MD (Comprehensive Ophthalmology & Corneal Surgery)",
        "experience_years": 14,
        "consultation_fee": 135.0,
        "languages": "English, Mandarin",
        "hospital_affiliation": "MediCare Eye & Vision Pavilion",
        "avatar_url": "https://images.unsplash.com/photo-1594824813682-192e2101b7a2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.96,
        "review_count": 140,
        "bio": "Ophthalmologist specializing in digital eye fatigue, diabetic retinopathy screening, dry eye therapies, and refractive corneal consultations.",
        "shifts": [
            (DayOfWeek.MONDAY, time(9, 0), time(16, 30), 30),
            (DayOfWeek.TUESDAY, time(9, 0), time(16, 30), 30),
            (DayOfWeek.WEDNESDAY, time(9, 0), time(16, 30), 30),
            (DayOfWeek.FRIDAY, time(9, 0), time(13, 30), 30),
        ]
    },
    {
        "email": "ethan.brooks@medicare.ai",
        "name": "Dr. Ethan Brooks, MD, FACS",
        "specialty": "ENT (Ear, Nose & Throat)",
        "department": "ENT (Ear, Nose & Throat)",
        "license": "MD-2024-99896",
        "location": "Sensory Health Pavilion, Suite 208",
        "phone": "(555) 234-1116",
        "qualifications": "MD, FACS (Otolaryngology - Head and Neck Surgery)",
        "experience_years": 17,
        "consultation_fee": 145.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400",
        "rating": 4.91,
        "review_count": 102,
        "bio": "Otolaryngologist specializing in chronic sinusitis, nasal airway obstruction, vocal cord pathology, hearing loss, and sleep apnea surgery.",
        "shifts": [
            (DayOfWeek.TUESDAY, time(9, 0), time(17, 0), 30),
            (DayOfWeek.WEDNESDAY, time(9, 0), time(17, 0), 30),
            (DayOfWeek.THURSDAY, time(9, 0), time(17, 0), 30),
        ]
    },
    {
        "email": "julian.ross@medicare.ai",
        "name": "Dr. Julian Ross, MD",
        "specialty": "Psychiatry",
        "department": "Psychiatry",
        "license": "MD-2024-99897",
        "location": "Behavioral Health Wing, Suite 410",
        "phone": "(555) 234-1117",
        "qualifications": "MD, Board Certified in Adult Psychiatry",
        "experience_years": 16,
        "consultation_fee": 165.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Behavioral Health Pavilion",
        "avatar_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400",
        "rating": 4.95,
        "review_count": 128,
        "bio": "Psychiatrist dedicated to evidence-based medication management for treatment-resistant depression, anxiety disorders, and adult ADHD.",
        "shifts": [
            (DayOfWeek.MONDAY, time(10, 0), time(18, 0), 30),
            (DayOfWeek.TUESDAY, time(10, 0), time(18, 0), 30),
            (DayOfWeek.THURSDAY, time(10, 0), time(18, 0), 30),
            (DayOfWeek.FRIDAY, time(10, 0), time(16, 0), 30),
        ]
    },
    {
        "email": "hannah.bailey@medicare.ai",
        "name": "Dr. Hannah Bailey, PsyD",
        "specialty": "Psychology",
        "department": "Psychology",
        "license": "PSY-2024-88712",
        "location": "Behavioral Health Wing, Suite 305",
        "phone": "(555) 234-1118",
        "qualifications": "PsyD, Licensed Clinical Psychologist",
        "experience_years": 10,
        "consultation_fee": 125.0,
        "languages": "English, Spanish",
        "hospital_affiliation": "MediCare Behavioral Health Pavilion",
        "avatar_url": "https://images.unsplash.com/photo-1594824813682-192e2101b7a2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.98,
        "review_count": 195,
        "bio": "Clinical psychologist specializing in cognitive behavioral therapy (CBT), acceptance and commitment therapy (ACT), and stress management.",
        "shifts": [
            (DayOfWeek.MONDAY, time(9, 0), time(17, 0), 45),
            (DayOfWeek.WEDNESDAY, time(9, 0), time(17, 0), 45),
            (DayOfWeek.THURSDAY, time(9, 0), time(17, 0), 45),
            (DayOfWeek.FRIDAY, time(9, 0), time(15, 0), 45),
        ]
    },
    {
        "email": "brian.zhao@medicare.ai",
        "name": "Dr. Brian Zhao, DDS",
        "specialty": "Dentistry",
        "department": "Dentistry",
        "license": "DDS-2024-77610",
        "location": "Dental Clinic, Suite 105",
        "phone": "(555) 234-1119",
        "qualifications": "DDS, Advanced General Dentistry & Prosthodontics",
        "experience_years": 11,
        "consultation_fee": 95.0,
        "languages": "English, Mandarin",
        "hospital_affiliation": "MediCare Oral Health Center",
        "avatar_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400",
        "rating": 4.92,
        "review_count": 110,
        "bio": "Dentist dedicated to pain-free dental prophylaxis, composite restorations, periodontal maintenance, and smile alignment.",
        "shifts": [
            (DayOfWeek.MONDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.TUESDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.WEDNESDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.THURSDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.FRIDAY, time(8, 30), time(14, 0), 30),
        ]
    },
    {
        "email": "jessica.hayes@medicare.ai",
        "name": "Dr. Jessica Hayes, MD, FACR",
        "specialty": "Rheumatology",
        "department": "Rheumatology",
        "license": "MD-2024-99898",
        "location": "North Tower, Suite 210",
        "phone": "(555) 234-1120",
        "qualifications": "MD, FACR (Fellow of the American College of Rheumatology)",
        "experience_years": 14,
        "consultation_fee": 155.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.93,
        "review_count": 86,
        "bio": "Rheumatologist diagnosing and managing rheumatoid arthritis, systemic lupus erythematosus, psoriatic arthritis, and biologic infusion protocols.",
        "shifts": [
            (DayOfWeek.TUESDAY, time(9, 0), time(16, 30), 30),
            (DayOfWeek.WEDNESDAY, time(9, 0), time(16, 30), 30),
            (DayOfWeek.THURSDAY, time(9, 0), time(16, 30), 30),
        ]
    },
    {
        "email": "marcus.thorne@medicare.ai",
        "name": "Dr. Marcus Thorne, MD",
        "specialty": "Hematology",
        "department": "Hematology",
        "license": "MD-2024-99899",
        "location": "Diagnostic Pavilion, Suite 304",
        "phone": "(555) 234-1121",
        "qualifications": "MD, Clinical Hematology & Transfusion Medicine",
        "experience_years": 15,
        "consultation_fee": 150.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400",
        "rating": 4.88,
        "review_count": 58,
        "bio": "Hematologist focusing on iron-deficiency and hemolytic anemias, deep vein thrombosis, immune thrombocytopenic purpura, and bleeding disorders.",
        "shifts": [
            (DayOfWeek.MONDAY, time(9, 0), time(16, 0), 30),
            (DayOfWeek.WEDNESDAY, time(9, 0), time(16, 0), 30),
            (DayOfWeek.FRIDAY, time(9, 0), time(15, 0), 30),
        ]
    },
    {
        "email": "priya.sharma@medicare.ai",
        "name": "Dr. Priya Sharma, MD",
        "specialty": "Infectious Diseases",
        "department": "Infectious Diseases",
        "license": "MD-2024-99900",
        "location": "Specialty Care Wing, Suite 315",
        "phone": "(555) 234-1122",
        "qualifications": "MD, Board Certified in Infectious Disease & Epidemiology",
        "experience_years": 13,
        "consultation_fee": 145.0,
        "languages": "English, Hindi",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1594824813682-192e2101b7a2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.95,
        "review_count": 76,
        "bio": "Infectious disease physician specializing in post-travel illness, chronic Lyme disease, antimicrobial stewardship, and immunization counseling.",
        "shifts": [
            (DayOfWeek.TUESDAY, time(9, 0), time(16, 30), 30),
            (DayOfWeek.THURSDAY, time(9, 0), time(16, 30), 30),
            (DayOfWeek.FRIDAY, time(9, 0), time(16, 30), 30),
        ]
    },
    {
        "email": "robert.vance@medicare.ai",
        "name": "Dr. Robert Vance, MD",
        "specialty": "Allergy & Immunology",
        "department": "Allergy & Immunology",
        "license": "MD-2024-99901",
        "location": "Specialty Care Wing, Suite 202",
        "phone": "(555) 234-1123",
        "qualifications": "MD, FAAAAI (Fellow of the American Academy of Allergy, Asthma & Immunology)",
        "experience_years": 18,
        "consultation_fee": 140.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Central Medical Center",
        "avatar_url": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400",
        "rating": 4.91,
        "review_count": 118,
        "bio": "Allergist and immunologist testing for seasonal rhinitis, food allergies, stinging insect venom hypersensitivity, chronic hives, and asthma.",
        "shifts": [
            (DayOfWeek.MONDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.WEDNESDAY, time(8, 30), time(16, 30), 30),
            (DayOfWeek.THURSDAY, time(8, 30), time(16, 30), 30),
        ]
    },
    {
        "email": "aaron.miller@medicare.ai",
        "name": "Dr. Aaron Miller, MD",
        "specialty": "Radiology",
        "department": "Radiology",
        "license": "MD-2024-99902",
        "location": "Imaging Center, Suite 101",
        "phone": "(555) 234-1124",
        "qualifications": "MD, Board Certified Diagnostic Radiologist",
        "experience_years": 16,
        "consultation_fee": 150.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Imaging Center",
        "avatar_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400",
        "rating": 4.90,
        "review_count": 72,
        "bio": "Diagnostic radiologist providing rapid clinical interpretations of 3T neuro MRI, cardiac CT angiography, body scans, and musculoskeletal ultrasound.",
        "shifts": [
            (DayOfWeek.MONDAY, time(8, 0), time(16, 0), 30),
            (DayOfWeek.TUESDAY, time(8, 0), time(16, 0), 30),
            (DayOfWeek.WEDNESDAY, time(8, 0), time(16, 0), 30),
            (DayOfWeek.THURSDAY, time(8, 0), time(16, 0), 30),
            (DayOfWeek.FRIDAY, time(8, 0), time(16, 0), 30),
        ]
    },
    {
        "email": "emily.watson@medicare.ai",
        "name": "Dr. Emily Watson, DPT",
        "specialty": "Physiotherapy",
        "department": "Physiotherapy",
        "license": "PT-2024-55419",
        "location": "Rehabilitation Pavilion, Suite 110",
        "phone": "(555) 234-1125",
        "qualifications": "DPT (Doctor of Physical Therapy), OCS",
        "experience_years": 9,
        "consultation_fee": 100.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Physical Therapy Center",
        "avatar_url": "https://images.unsplash.com/photo-1594824813682-192e2101b7a2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.99,
        "review_count": 220,
        "bio": "Orthopedic physical therapist focusing on spine stabilization, post-operative ACL and meniscus rehab, shoulder impingement, and athletic mobility.",
        "shifts": [
            (DayOfWeek.MONDAY, time(8, 0), time(17, 0), 45),
            (DayOfWeek.TUESDAY, time(8, 0), time(17, 0), 45),
            (DayOfWeek.WEDNESDAY, time(8, 0), time(17, 0), 45),
            (DayOfWeek.THURSDAY, time(8, 0), time(17, 0), 45),
            (DayOfWeek.FRIDAY, time(8, 0), time(15, 0), 45),
            (DayOfWeek.SATURDAY, time(9, 0), time(13, 0), 45),
        ]
    },
    {
        "email": "jonathan.cross@medicare.ai",
        "name": "Dr. Jonathan Cross, MD, FACEP",
        "specialty": "Emergency Medicine",
        "department": "Emergency Medicine",
        "license": "MD-2024-99903",
        "location": "Ambulance Pavilion, Ground Floor",
        "phone": "(555) 234-1126",
        "qualifications": "MD, FACEP (American College of Emergency Physicians)",
        "experience_years": 21,
        "consultation_fee": 200.0,
        "languages": "English, Spanish",
        "hospital_affiliation": "MediCare Level 1 Trauma Center",
        "avatar_url": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400",
        "rating": 4.96,
        "review_count": 180,
        "bio": "Attending emergency physician directing acute resuscitation, trauma stabilization, emergency toxicology, and critical bedside ultrasonography.",
        "shifts": [
            (DayOfWeek.MONDAY, time(8, 0), time(18, 0), 30),
            (DayOfWeek.TUESDAY, time(8, 0), time(18, 0), 30),
            (DayOfWeek.WEDNESDAY, time(8, 0), time(18, 0), 30),
            (DayOfWeek.THURSDAY, time(8, 0), time(18, 0), 30),
            (DayOfWeek.FRIDAY, time(8, 0), time(18, 0), 30),
            (DayOfWeek.SATURDAY, time(8, 0), time(18, 0), 30),
            (DayOfWeek.SUNDAY, time(8, 0), time(18, 0), 30),
        ]
    },
    {
        "email": "margaret.ross@medicare.ai",
        "name": "Dr. Margaret Ross, MD",
        "specialty": "Geriatrics",
        "department": "Geriatrics",
        "license": "MD-2024-99904",
        "location": "Senior Wellness Pavilion, Suite 210",
        "phone": "(555) 234-1127",
        "qualifications": "MD, Board Certified in Internal Medicine & Geriatrics",
        "experience_years": 22,
        "consultation_fee": 130.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Senior Wellness Center",
        "avatar_url": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.97,
        "review_count": 145,
        "bio": "Geriatrician dedicated to fall prevention, mild cognitive impairment assessments, osteoporosis therapy, and deprescribing redundant medications.",
        "shifts": [
            (DayOfWeek.MONDAY, time(9, 0), time(16, 0), 30),
            (DayOfWeek.TUESDAY, time(9, 0), time(16, 0), 30),
            (DayOfWeek.THURSDAY, time(9, 0), time(16, 0), 30),
            (DayOfWeek.FRIDAY, time(9, 0), time(14, 0), 30),
        ]
    },
    {
        "email": "evelyn.scott@medicare.ai",
        "name": "Dr. Evelyn Scott, MS, RD, CDN",
        "specialty": "Nutrition & Dietetics",
        "department": "Nutrition & Dietetics",
        "license": "RD-2024-33219",
        "location": "Wellness Center, Suite 108",
        "phone": "(555) 234-1128",
        "qualifications": "MS, Registered Dietitian Nutritionist, Certified Diabetes Care Specialist",
        "experience_years": 10,
        "consultation_fee": 90.0,
        "languages": "English",
        "hospital_affiliation": "MediCare Lifestyle & Wellness Center",
        "avatar_url": "https://images.unsplash.com/photo-1594824813682-192e2101b7a2?auto=format&fit=crop&q=80&w=400",
        "rating": 4.99,
        "review_count": 215,
        "bio": "Clinical dietitian focusing on personalized carbohydrate counting, Mediterranean cardioprotective dietary plans, and therapeutic lifestyle changes.",
        "shifts": [
            (DayOfWeek.MONDAY, time(8, 30), time(17, 0), 30),
            (DayOfWeek.TUESDAY, time(8, 30), time(17, 0), 30),
            (DayOfWeek.WEDNESDAY, time(8, 30), time(17, 0), 30),
            (DayOfWeek.THURSDAY, time(8, 30), time(17, 0), 30),
            (DayOfWeek.FRIDAY, time(8, 30), time(15, 0), 30),
        ]
    },
]

SAMPLE_FEEDBACKS = [
    (5, "Exceptional clinical care. Listened to every symptom, explained the medication rationale in clear language, and made me feel completely supported."),
    (5, "Outstanding experience. The doctor reviewed my laboratory trends thoroughly and proposed an actionable treatment plan with zero rush."),
    (4, "Very knowledgeable and thorough physician. Clear instructions on next steps and when to follow up for routine monitoring."),
    (5, "Took the time to explain the diagnostic test results in plain terms. Compassionate, professional, and reassuring demeanor."),
    (5, "Prompt appointment, seamless telehealth connection, and immediate prescription refill sent to my local pharmacy. Highly recommended!"),
]


async def seed_departments_and_doctors(session: AsyncSession) -> None:
    """Seed the 28 departments, doctors, shift schedules, and reviews."""
    try:
        # 1. Seed / Update 28 Departments
        dept_id_map: Dict[str, uuid.UUID] = {}
        for d_spec in DEPARTMENTS_CATALOG:
            d_stmt = select(Department).where(Department.dept_cd == d_spec["code"])
            d_res = await session.execute(d_stmt)
            dept_obj = d_res.scalar_one_or_none()
            if not dept_obj:
                dept_obj = Department(
                    dept_id=uuid.uuid4(),
                    dept_cd=d_spec["code"],
                    dept_nm=d_spec["name"],
                    dept_dscrptn=d_spec["description"],
                    locn_nm=d_spec["location"],
                    phone_num=d_spec["phone"],
                    dept_sts_cd="ACTIVE",
                    icon_nm=d_spec["icon"],
                    email_addr=d_spec["email"],
                    head_of_dept=d_spec["head"],
                    dr_count=1,
                )
                session.add(dept_obj)
                await session.flush()
            else:
                dept_obj.dept_nm = d_spec["name"]
                dept_obj.dept_dscrptn = d_spec["description"]
                dept_obj.icon_nm = d_spec["icon"]
                dept_obj.locn_nm = d_spec["location"]
                dept_obj.phone_num = d_spec["phone"]
                dept_obj.email_addr = d_spec["email"]
                dept_obj.head_of_dept = d_spec["head"]
                dept_obj.dept_sts_cd = "ACTIVE"
            dept_id_map[d_spec["name"]] = dept_obj.dept_id

        # 2. Seed / Update Doctors
        created_doctors: List[Doctor] = []
        for doc_info in DOCTORS_CATALOG:
            u_stmt = select(User).where(User.email == doc_info["email"])
            u_res = await session.execute(u_stmt)
            u_obj = u_res.scalar_one_or_none()
            if not u_obj:
                u_obj = User(
                    id=uuid.uuid4(),
                    email=doc_info["email"],
                    hashed_password=hash_password("DoctorPass123!"),
                    full_name=doc_info["name"],
                    role=UserRole.DOCTOR,
                    is_active=True,
                    is_verified=True,
                )
                session.add(u_obj)
                await session.flush()
            else:
                u_obj.full_name = doc_info["name"]

            d_stmt = select(Doctor).where(Doctor.user_id == u_obj.id)
            d_res = await session.execute(d_stmt)
            d_obj = d_res.scalar_one_or_none()
            dept_id_val = dept_id_map.get(doc_info["department"])

            if not d_obj:
                d_obj = Doctor(
                    id=uuid.uuid4(),
                    user_id=u_obj.id,
                    license_number=doc_info["license"],
                    specialty=doc_info["specialty"],
                    department=doc_info["department"],
                    office_location=doc_info["location"],
                    phone=doc_info["phone"],
                    email=doc_info["email"],
                    qualifications=doc_info["qualifications"],
                    experience_years=doc_info["experience_years"],
                    consultation_fee=doc_info["consultation_fee"],
                    languages=doc_info["languages"],
                    hospital_affiliation=doc_info["hospital_affiliation"],
                    avatar_url=doc_info["avatar_url"],
                    rating=doc_info["rating"],
                    review_count=doc_info["review_count"],
                    department_id=dept_id_val,
                    is_accepting_patients=True,
                    bio=doc_info["bio"],
                )
                session.add(d_obj)
                await session.flush()
            else:
                d_obj.specialty = doc_info["specialty"]
                d_obj.department = doc_info["department"]
                d_obj.office_location = doc_info["location"]
                d_obj.phone = doc_info["phone"]
                d_obj.email = doc_info["email"]
                d_obj.qualifications = doc_info["qualifications"]
                d_obj.experience_years = doc_info["experience_years"]
                d_obj.consultation_fee = doc_info["consultation_fee"]
                d_obj.languages = doc_info["languages"]
                d_obj.hospital_affiliation = doc_info["hospital_affiliation"]
                d_obj.avatar_url = doc_info["avatar_url"]
                d_obj.rating = doc_info["rating"]
                d_obj.review_count = doc_info["review_count"]
                d_obj.department_id = dept_id_val
                d_obj.is_accepting_patients = True
                d_obj.bio = doc_info["bio"]

            created_doctors.append(d_obj)

            # Ensure Shifts
            for dow, start_tm, end_tm, duration in doc_info["shifts"]:
                s_stmt = select(DoctorSchedule).where(
                    DoctorSchedule.doctor_id == d_obj.id,
                    DoctorSchedule.day_of_week == dow,
                )
                s_res = await session.execute(s_stmt)
                s_obj = s_res.scalar_one_or_none()
                if not s_obj:
                    s_obj = DoctorSchedule(
                        id=uuid.uuid4(),
                        doctor_id=d_obj.id,
                        day_of_week=dow,
                        start_time=start_tm,
                        end_time=end_tm,
                        slot_duration_minutes=duration,
                        is_telehealth_capable=True,
                        is_in_person_capable=True,
                        clinic_timezone="America/New_York",
                        is_active=True,
                    )
                    session.add(s_obj)
                else:
                    s_obj.is_active = True
                    s_obj.start_time = start_tm
                    s_obj.end_time = end_tm
                    s_obj.slot_duration_minutes = duration
                    s_obj.clinic_timezone = "America/New_York"

        await session.flush()

        # Update department doctor counts
        for dept_name, d_id in dept_id_map.items():
            cnt = sum(1 for d in created_doctors if d.department == dept_name or d.specialty == dept_name)
            dept_record = await session.get(Department, d_id)
            if dept_record:
                dept_record.dr_count = max(cnt, 1)

        # 3. Seed Sample Patient Reviews for doctors
        pat_res = await session.execute(select(Patient).limit(3))
        patients = pat_res.scalars().all()
        if patients:
            alice_patient = patients[0]
            reviewers = [
                ("Alice J.", 5, "Dr. Chen is simply phenomenal. Patiently explained my ECG and ambulatory pressure metrics with great care."),
                ("Robert K.", 5, "Extremely thorough clinical consultation. Took time to address all my medication queries."),
                ("Maria S.", 4, "Great experience, very knowledgeable physician and minimal wait time."),
                ("David M.", 5, "Outstanding medical professionalism. The hospital portal and appointment confirmation were seamless."),
            ]
            for doc in created_doctors[:5]:
                existing_rev = await session.execute(
                    select(DoctorReview).where(DoctorReview.doctor_id == doc.id)
                )
                if not existing_rev.scalars().first():
                    for name, stars, txt in reviewers:
                        rev = DoctorReview(
                            id=uuid.uuid4(),
                            doctor_id=doc.id,
                            patient_id=alice_patient.id,
                            rating=stars,
                            review_text=txt,
                            patient_display_name=name,
                            is_verified_appointment=True,
                            is_approved=True,
                        )
                        session.add(rev)

        await session.flush()
        log.info("Successfully seeded 28 departments, comprehensive doctor directory, and clinical reviews.")
    except Exception as exc:
        log.warning("Seeding departments and doctors skipped or encountered warning", error=str(exc))
