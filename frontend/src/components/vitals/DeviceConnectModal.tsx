import React from 'react'
import { X, Cpu } from 'lucide-react'
import { DeviceConnectionCenter } from './DeviceConnectionCenter'

export interface DeviceConnectModalProps {
  isOpen: boolean
  onClose: () => void
  onDeviceLinked?: (deviceName: string) => void
  onOpenManualBp?: () => void
  onOpenManualGlucose?: () => void
}

export const DeviceConnectModal: React.FC<DeviceConnectModalProps> = ({
  isOpen,
  onClose,
  onDeviceLinked,
  onOpenManualBp,
  onOpenManualGlucose,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl my-8">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-20 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center shadow-lg cursor-pointer transition-colors"
          title="Close"
        >
          <X size={16} />
        </button>

        <DeviceConnectionCenter
          onReadingImported={() => {
            onDeviceLinked?.('Connected Medical Peripheral')
          }}
          onOpenManualBp={() => {
            onClose()
            onOpenManualBp?.()
          }}
          onOpenManualGlucose={() => {
            onClose()
            onOpenManualGlucose?.()
          }}
        />
      </div>
    </div>
  )
}
