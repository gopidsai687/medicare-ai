import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'

// Pages — lazy loaded for performance
import { lazy, Suspense } from 'react'

const LoginPage = lazy(() => import('@/pages/LoginPage'))

// Patient
const PatientDashboard = lazy(() => import('@/pages/patient/Dashboard'))
const PatientAppointments = lazy(() => import('@/pages/patient/Appointments'))
const PatientRecords = lazy(() => import('@/pages/patient/MedicalRecords'))
const PatientMedications = lazy(() => import('@/pages/patient/Medications'))
const PatientLabResults = lazy(() => import('@/pages/patient/LabResults'))
const PatientAIAssistant = lazy(() => import('@/pages/patient/AIAssistant'))
const PatientSettings = lazy(() => import('@/pages/patient/Settings'))

// Doctor
const DoctorDashboard = lazy(() => import('@/pages/doctor/Dashboard'))
const DoctorPatients = lazy(() => import('@/pages/doctor/MyPatients'))
const DoctorSchedule = lazy(() => import('@/pages/doctor/Schedule'))
const DoctorEncounters = lazy(() => import('@/pages/doctor/Encounters'))
const DoctorLabs = lazy(() => import('@/pages/doctor/Labs'))
const DoctorAnalytics = lazy(() => import('@/pages/doctor/Analytics'))
const DoctorAIAssistant = lazy(() => import('@/pages/doctor/AIAssistant'))

// Admin
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const AdminPatients = lazy(() => import('@/pages/admin/Patients'))
const AdminDoctors = lazy(() => import('@/pages/admin/Doctors'))
const AdminDepartments = lazy(() => import('@/pages/admin/Departments'))
const AdminAppointments = lazy(() => import('@/pages/admin/Appointments'))
const AdminAuditLogs = lazy(() => import('@/pages/admin/AuditLogs'))
const AdminSettings = lazy(() => import('@/pages/admin/Settings'))

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div className="text-center animate-fade-in">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
           style={{ borderColor: 'rgba(49,130,244,0.3)', borderTopColor: '#3182f4' }} />
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
  },

  // ── Patient Portal ────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['patient']} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/patient', element: withSuspense(PatientDashboard) },
          { path: '/patient/appointments', element: withSuspense(PatientAppointments) },
          { path: '/patient/records', element: withSuspense(PatientRecords) },
          { path: '/patient/medications', element: withSuspense(PatientMedications) },
          { path: '/patient/labs', element: withSuspense(PatientLabResults) },
          { path: '/patient/ai', element: withSuspense(PatientAIAssistant) },
          { path: '/patient/settings', element: withSuspense(PatientSettings) },
        ],
      },
    ],
  },

  // ── Doctor Portal ─────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['doctor', 'nurse']} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/doctor', element: withSuspense(DoctorDashboard) },
          { path: '/doctor/patients', element: withSuspense(DoctorPatients) },
          { path: '/doctor/schedule', element: withSuspense(DoctorSchedule) },
          { path: '/doctor/encounters', element: withSuspense(DoctorEncounters) },
          { path: '/doctor/labs', element: withSuspense(DoctorLabs) },
          { path: '/doctor/analytics', element: withSuspense(DoctorAnalytics) },
          { path: '/doctor/ai', element: withSuspense(DoctorAIAssistant) },
        ],
      },
    ],
  },

  // ── Admin Portal ──────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['admin']} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/admin', element: withSuspense(AdminDashboard) },
          { path: '/admin/patients', element: withSuspense(AdminPatients) },
          { path: '/admin/doctors', element: withSuspense(AdminDoctors) },
          { path: '/admin/departments', element: withSuspense(AdminDepartments) },
          { path: '/admin/appointments', element: withSuspense(AdminAppointments) },
          { path: '/admin/audit-logs', element: withSuspense(AdminAuditLogs) },
          { path: '/admin/settings', element: withSuspense(AdminSettings) },
        ],
      },
    ],
  },

  // ── Fallback ──────────────────────────────────────────────────────────────
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '*', element: <Navigate to="/login" replace /> },
])
