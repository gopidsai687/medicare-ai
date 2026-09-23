import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt)
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMM d, yyyy HH:mm')
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatMRN(mrn: string): string {
  return `MRN-${mrn.toUpperCase().padStart(8, '0')}`
}

export function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    patient: 'badge-teal',
    doctor: 'badge-blue',
    nurse: 'badge-green',
    admin: 'badge-amber',
  }
  return colors[role] ?? 'badge-gray'
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    patient: 'Patient',
    doctor: 'Doctor',
    nurse: 'Nurse',
    admin: 'Administrator',
  }
  return labels[role] ?? role
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
