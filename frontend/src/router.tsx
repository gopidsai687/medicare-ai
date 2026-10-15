import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Suspense } from 'react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

// Pages — resiliently lazy loaded with auto-reload recovery for stale deployment chunks
const LoginPage = lazyWithRetry(() => import('@/pages/LoginPage'), 'LoginPage')

// Patient
const PatientDashboard = lazyWithRetry(() => import('@/pages/patient/Dashboard'), 'PatientDashboard')
const PatientAppointments = lazyWithRetry(() => import('@/pages/patient/Appointments'), 'PatientAppointments')
const PatientRecords = lazyWithRetry(() => import('@/pages/patient/MedicalRecords'), 'PatientRecords')
const PatientMedications = lazyWithRetry(() => import('@/pages/patient/Medications'), 'PatientMedications')
const PatientLabResults = lazyWithRetry(() => import('@/pages/patient/LabResults'), 'PatientLabResults')
const PatientAIAssistant = lazyWithRetry(() => import('@/pages/patient/AIAssistant'), 'PatientAIAssistant')
const PatientPrescriptionAnalysis = lazyWithRetry(() => import('@/pages/patient/PrescriptionAnalysis'), 'PatientPrescriptionAnalysis')
const PatientMedicalReportAnalysis = lazyWithRetry(() => import('@/pages/patient/MedicalReportAnalysis'), 'PatientMedicalReportAnalysis')
const PatientPreviousAnalyses = lazyWithRetry(() => import('@/pages/patient/PreviousAnalyses'), 'PatientPreviousAnalyses')
const PatientVitalSense = lazyWithRetry(() => import('@/pages/patient/VitalSense'), 'PatientVitalSense')
const PatientBloodPressure = lazyWithRetry(() => import('@/pages/patient/BloodPressureTracking'), 'PatientBloodPressure')
const PatientBloodGlucose = lazyWithRetry(() => import('@/pages/patient/BloodGlucoseTracking'), 'PatientBloodGlucose')
const PatientNearbyHospitals = lazyWithRetry(() => import('@/pages/patient/NearbyHospitals'), 'PatientNearbyHospitals')
const PatientHealthProfile = lazyWithRetry(() => import('@/pages/patient/PatientHealthProfile'), 'PatientHealthProfile')
const PatientPPGResearch = lazyWithRetry(() => import('@/pages/patient/PPGResearch'), 'PatientPPGResearch')
const PatientDeviceConnections = lazyWithRetry(() => import('@/pages/patient/DeviceConnections'), 'PatientDeviceConnections')
const PatientSettings = lazyWithRetry(() => import('@/pages/patient/Settings'), 'PatientSettings')

// Doctor
const DoctorDashboard = lazyWithRetry(() => import('@/pages/doctor/Dashboard'), 'DoctorDashboard')
const DoctorVitalSenseClinical = lazyWithRetry(() => import('@/pages/doctor/VitalSenseClinical'), 'DoctorVitalSenseClinical')
const DoctorAlertQueue = lazyWithRetry(() => import('@/pages/doctor/DoctorAlertQueue'), 'DoctorAlertQueue')
const DoctorPatients = lazyWithRetry(() => import('@/pages/doctor/MyPatients'), 'DoctorPatients')
const DoctorSchedule = lazyWithRetry(() => import('@/pages/doctor/Schedule'), 'DoctorSchedule')
const DoctorEncounters = lazyWithRetry(() => import('@/pages/doctor/Encounters'), 'DoctorEncounters')
const DoctorLabs = lazyWithRetry(() => import('@/pages/doctor/Labs'), 'DoctorLabs')
const DoctorAnalytics = lazyWithRetry(() => import('@/pages/doctor/Analytics'), 'DoctorAnalytics')
const DoctorAIAssistant = lazyWithRetry(() => import('@/pages/doctor/AIAssistant'), 'DoctorAIAssistant')
const DoctorSettings = lazyWithRetry(() => import('@/pages/doctor/Settings'), 'DoctorSettings')

// Admin
const AdminDashboard = lazyWithRetry(() => import('@/pages/admin/Dashboard'), 'AdminDashboard')
const AdminPatients = lazyWithRetry(() => import('@/pages/admin/Patients'), 'AdminPatients')
const AdminDoctors = lazyWithRetry(() => import('@/pages/admin/Doctors'), 'AdminDoctors')
const AdminDepartments = lazyWithRetry(() => import('@/pages/admin/Departments'), 'AdminDepartments')
const AdminAppointments = lazyWithRetry(() => import('@/pages/admin/Appointments'), 'AdminAppointments')
const AdminAuditLogs = lazyWithRetry(() => import('@/pages/admin/AuditLogs'), 'AdminAuditLogs')
const AdminSettings = lazyWithRetry(() => import('@/pages/admin/Settings'), 'AdminSettings')

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div className="text-center animate-fade-in">
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
        style={{ borderColor: 'rgba(49,130,244,0.3)', borderTopColor: '#3182f4' }}
      />
      <div style={{ fontSize: '0.78rem', color: '#7a9ec2', fontWeight: 500 }}>
        Loading clinical view...
      </div>
    </div>
  </div>
)

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>,
    errorElement: <RouteErrorBoundary />,
  },

  // ── Patient Portal ────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['patient']} />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppShell />,
        errorElement: <RouteErrorBoundary />,
        children: [
          { path: '/patient', element: withSuspense(PatientDashboard), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/appointments', element: withSuspense(PatientAppointments), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/records', element: withSuspense(PatientRecords), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/medications', element: withSuspense(PatientMedications), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/labs', element: withSuspense(PatientLabResults), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/ai', element: withSuspense(PatientAIAssistant), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/prescriptions', element: withSuspense(PatientPrescriptionAnalysis), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/reports', element: withSuspense(PatientMedicalReportAnalysis), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/analyses', element: withSuspense(PatientPreviousAnalyses), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/vitalsense', element: withSuspense(PatientVitalSense), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/vitalsense/blood-pressure', element: withSuspense(PatientBloodPressure), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/vitalsense/blood-glucose', element: withSuspense(PatientBloodGlucose), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/hospitals', element: withSuspense(PatientNearbyHospitals), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/profile', element: withSuspense(PatientHealthProfile), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/vitalsense/research', element: withSuspense(PatientPPGResearch), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/devices', element: withSuspense(PatientDeviceConnections), errorElement: <RouteErrorBoundary /> },
          { path: '/patient/settings', element: withSuspense(PatientSettings), errorElement: <RouteErrorBoundary /> },
        ],
      },
    ],
  },

  // ── Doctor Portal ─────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['doctor', 'nurse']} />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppShell />,
        errorElement: <RouteErrorBoundary />,
        children: [
          { path: '/doctor', element: withSuspense(DoctorDashboard), errorElement: <RouteErrorBoundary /> },
          { path: '/doctor/vitalsense', element: withSuspense(DoctorVitalSenseClinical), errorElement: <RouteErrorBoundary /> },
          { path: '/doctor/alerts', element: withSuspense(DoctorAlertQueue), errorElement: <RouteErrorBoundary /> },
          { path: '/doctor/patients', element: withSuspense(DoctorPatients), errorElement: <RouteErrorBoundary /> },
          { path: '/doctor/schedule', element: withSuspense(DoctorSchedule), errorElement: <RouteErrorBoundary /> },
          { path: '/doctor/encounters', element: withSuspense(DoctorEncounters), errorElement: <RouteErrorBoundary /> },
          { path: '/doctor/labs', element: withSuspense(DoctorLabs), errorElement: <RouteErrorBoundary /> },
          { path: '/doctor/analytics', element: withSuspense(DoctorAnalytics), errorElement: <RouteErrorBoundary /> },
          { path: '/doctor/ai', element: withSuspense(DoctorAIAssistant), errorElement: <RouteErrorBoundary /> },
          { path: '/doctor/settings', element: withSuspense(DoctorSettings), errorElement: <RouteErrorBoundary /> },
        ],
      },
    ],
  },

  // ── Admin Portal ──────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['admin']} />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppShell />,
        errorElement: <RouteErrorBoundary />,
        children: [
          { path: '/admin', element: withSuspense(AdminDashboard), errorElement: <RouteErrorBoundary /> },
          { path: '/admin/patients', element: withSuspense(AdminPatients), errorElement: <RouteErrorBoundary /> },
          { path: '/admin/doctors', element: withSuspense(AdminDoctors), errorElement: <RouteErrorBoundary /> },
          { path: '/admin/departments', element: withSuspense(AdminDepartments), errorElement: <RouteErrorBoundary /> },
          { path: '/admin/appointments', element: withSuspense(AdminAppointments), errorElement: <RouteErrorBoundary /> },
          { path: '/admin/audit-logs', element: withSuspense(AdminAuditLogs), errorElement: <RouteErrorBoundary /> },
          { path: '/admin/settings', element: withSuspense(AdminSettings), errorElement: <RouteErrorBoundary /> },
        ],
      },
    ],
  },

  // ── Fallback ──────────────────────────────────────────────────────────────
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '*', element: <Navigate to="/login" replace /> },
])
