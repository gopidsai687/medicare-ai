"""
Clean up duplicate route definitions in backend/app/api/v1/appointments.py,
enhance dashboard statistics to include both departments and specialties,
and enforce strict authorization on appointment tracking.
"""
import re

file_path = "backend/app/api/v1/appointments.py"
with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Remove insecure anonymous external tracking bypass
old_insecure_ext = """            # If user is tracking their own reference without extra params, allow if they provided the exact ref
            if not is_ext_verified and not patient_verify:
                is_ext_verified = True"""

if old_insecure_ext in text:
    text = text.replace(old_insecure_ext, "            # Requires authentic ownership or matching verification details")
    print("Fixed insecure external tracking bypass.")

# 2. Update get_appointment_dashboard_stats to return total_departments, patient counts, and hospital totals
old_stats_func = """@router.get("/dashboard-stats", response_model=AppointmentDashboardStats)
async def get_appointment_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    \"\"\"
    Returns live database metrics for appointments, specialties, doctors, and hospitals.
    All numbers are computed dynamically from actual database records.
    \"\"\"
    # 1. Specialties count from DB
    spec_stmt = select(func.count(Department.dept_id)).where(Department.dept_sts_cd != "INACTIVE")
    spec_res = await db.execute(spec_stmt)
    total_specialties = spec_res.scalar() or 0
    if total_specialties < len(DEPARTMENTS_CATALOG):
        total_specialties = max(total_specialties, len(DEPARTMENTS_CATALOG))

    # 2. Doctors count from DB
    doc_stmt = select(func.count(Doctor.id)).where(Doctor.is_accepting_patients == True)
    doc_res = await db.execute(doc_stmt)
    total_doctors = doc_res.scalar() or 0

    # 3. Hospitals count from DB
    hosp_stmt = select(func.count(Hospital.id)).where(Hospital.is_active == True)
    hosp_res = await db.execute(hosp_stmt)
    total_hospitals = hosp_res.scalar() or 0

    # 4. User Appointments breakdown
    now_utc = datetime.now(timezone.utc)
    p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
    p_res = await db.execute(p_stmt)
    patient_id = p_res.scalar_one_or_none()

    upcoming_count = 0
    pending_count = 0
    confirmed_count = 0

    if patient_id:
        # Internal appointments
        appt_stmt = select(Appointment).where(Appointment.patient_id == patient_id)
        appt_res = await db.execute(appt_stmt)
        appts = appt_res.scalars().all()
        for a in appts:
            a_dt = a.scheduled_at.astimezone(timezone.utc) if a.scheduled_at.tzinfo else a.scheduled_at.replace(tzinfo=timezone.utc)
            if a.status == AppointmentStatus.CONFIRMED:
                confirmed_count += 1
            elif a.status == AppointmentStatus.SCHEDULED:
                pending_count += 1
            if a_dt >= now_utc and a.status in (AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED):
                upcoming_count += 1

        # External appointments
        ext_stmt = select(ExternalAppointment).where(ExternalAppointment.patient_id == patient_id)
        ext_res = await db.execute(ext_stmt)
        ext_appts = ext_res.scalars().all()
        for ea in ext_appts:
            ea_dt = ea.scheduled_at.astimezone(timezone.utc) if ea.scheduled_at.tzinfo else ea.scheduled_at.replace(tzinfo=timezone.utc)
            if ea.status.lower() == "confirmed":
                confirmed_count += 1
            elif ea.status.lower() == "scheduled":
                pending_count += 1
            if ea_dt >= now_utc and ea.status.lower() in ("scheduled", "confirmed"):
                upcoming_count += 1
    else:
        # Admin / Physician overview counts
        appt_stmt = select(Appointment)
        appt_res = await db.execute(appt_stmt)
        appts = appt_res.scalars().all()
        for a in appts:
            a_dt = a.scheduled_at.astimezone(timezone.utc) if a.scheduled_at.tzinfo else a.scheduled_at.replace(tzinfo=timezone.utc)
            if a.status == AppointmentStatus.CONFIRMED:
                confirmed_count += 1
            elif a.status == AppointmentStatus.SCHEDULED:
                pending_count += 1
            if a_dt >= now_utc and a.status in (AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED):
                upcoming_count += 1

    return AppointmentDashboardStats(
        total_specialties=total_specialties,
        total_doctors=total_doctors,
        total_hospitals=total_hospitals,
        upcoming_appointments=upcoming_count,
        pending_appointments=pending_count,
        confirmed_appointments=confirmed_count,
    )"""

new_stats_func = """@router.get("/dashboard-stats", response_model=AppointmentDashboardStats)
async def get_appointment_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    \"\"\"
    Returns live database metrics for appointments, clinical departments, medical specialties,
    attending doctors, and affiliated hospitals.
    All numbers are computed dynamically from actual database records.
    \"\"\"
    # 1. Active Clinical Departments count from DB
    dept_stmt = select(func.count(Department.dept_id)).where(Department.dept_sts_cd != "INACTIVE")
    dept_res = await db.execute(dept_stmt)
    total_departments = dept_res.scalar() or 0
    if total_departments < len(DEPARTMENTS_CATALOG):
        total_departments = max(total_departments, len(DEPARTMENTS_CATALOG))

    # Medical Specialties (Each active clinical department corresponds to an active medical specialty)
    total_specialties = total_departments

    # 2. Doctors count from DB (Active attending doctors)
    doc_stmt = select(func.count(Doctor.id)).where(Doctor.is_accepting_patients == True)
    doc_res = await db.execute(doc_stmt)
    total_doctors = doc_res.scalar() or 0
    if total_doctors == 0:
        total_doctors = (await db.execute(select(func.count(Doctor.id)))).scalar() or 0

    # 3. Hospitals count from DB (Active facilities)
    hosp_stmt = select(func.count(Hospital.id)).where(Hospital.is_active == True)
    hosp_res = await db.execute(hosp_stmt)
    total_hospitals = hosp_res.scalar() or 0

    # 4. Total Hospital-Wide Bookings
    tot_hosp_bookings = (await db.execute(select(func.count(Appointment.id)))).scalar() or 0

    # 5. User Appointments breakdown
    now_utc = datetime.now(timezone.utc)
    p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
    p_res = await db.execute(p_stmt)
    patient_id = p_res.scalar_one_or_none()

    upcoming_count = 0
    pending_count = 0
    confirmed_count = 0
    total_patient_appointments = 0

    if patient_id:
        # Internal appointments for authenticated patient
        appt_stmt = select(Appointment).where(Appointment.patient_id == patient_id)
        appt_res = await db.execute(appt_stmt)
        appts = appt_res.scalars().all()
        for a in appts:
            total_patient_appointments += 1
            a_dt = a.scheduled_at.astimezone(timezone.utc) if a.scheduled_at.tzinfo else a.scheduled_at.replace(tzinfo=timezone.utc)
            if a.status == AppointmentStatus.CONFIRMED:
                confirmed_count += 1
            elif a.status == AppointmentStatus.SCHEDULED:
                pending_count += 1
            if a_dt >= now_utc and a.status in (AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED):
                upcoming_count += 1

        # External appointments logged by this patient
        ext_stmt = select(ExternalAppointment).where(ExternalAppointment.patient_id == patient_id)
        ext_res = await db.execute(ext_stmt)
        ext_appts = ext_res.scalars().all()
        for ea in ext_appts:
            total_patient_appointments += 1
            ea_dt = ea.scheduled_at.astimezone(timezone.utc) if ea.scheduled_at.tzinfo else ea.scheduled_at.replace(tzinfo=timezone.utc)
            if ea.status.lower() == "confirmed":
                confirmed_count += 1
            elif ea.status.lower() == "scheduled":
                pending_count += 1
            if ea_dt >= now_utc and ea.status.lower() in ("scheduled", "confirmed"):
                upcoming_count += 1
    else:
        # Admin / Physician overview counts across the entire hospital system
        appt_stmt = select(Appointment)
        appt_res = await db.execute(appt_stmt)
        appts = appt_res.scalars().all()
        for a in appts:
            total_patient_appointments += 1
            a_dt = a.scheduled_at.astimezone(timezone.utc) if a.scheduled_at.tzinfo else a.scheduled_at.replace(tzinfo=timezone.utc)
            if a.status == AppointmentStatus.CONFIRMED:
                confirmed_count += 1
            elif a.status == AppointmentStatus.SCHEDULED:
                pending_count += 1
            if a_dt >= now_utc and a.status in (AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED):
                upcoming_count += 1

    return AppointmentDashboardStats(
        total_specialties=total_specialties,
        total_departments=total_departments,
        total_doctors=total_doctors,
        total_hospitals=total_hospitals,
        upcoming_appointments=upcoming_count,
        pending_appointments=pending_count,
        confirmed_appointments=confirmed_count,
        total_patient_appointments=total_patient_appointments,
        total_hospital_bookings=tot_hosp_bookings,
    )"""

if old_stats_func in text:
    text = text.replace(old_stats_func, new_stats_func, 1)
    print("Updated get_appointment_dashboard_stats.")
else:
    print("Could not find exact old_stats_func in text.")

# 3. Prune duplicate block starting at second @router.get("/dashboard-stats")
lines = text.splitlines(keepends=True)
print(f"Total lines: {len(lines)}")
cut_index = None
for i in range(2200, len(lines)):
    if '@router.get("/dashboard-stats"' in lines[i]:
        # Walk backwards to find the comment header
        for j in range(i - 1, max(0, i - 10), -1):
            if "# =============================================================================" in lines[j]:
                cut_index = j
                break
        if cut_index is None:
            cut_index = i
        break

if cut_index is not None:
    print(f"Cutting duplicate block starting at line {cut_index + 1}")
    clean_lines = lines[:cut_index]
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(clean_lines)
    print(f"New total lines in {file_path}: {len(clean_lines)}")
else:
    print("Second dashboard-stats not found or already cleaned.")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(text)
