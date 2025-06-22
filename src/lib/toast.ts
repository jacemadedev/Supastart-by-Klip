import { toast } from 'sonner'

type ToastType = 'success' | 'error' | 'loading' | 'info'

interface ToastOptions {
  id?: string
  duration?: number
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left'
  action?: {
    label: string
    onClick: () => void
  }
}

export const showToast = (
  message: string,
  type: ToastType = 'info',
  options: ToastOptions = {}
) => {
  const { id, duration, position, action } = options

  switch (type) {
    case 'success':
      return toast.success(message, { id, duration, position, action })
    case 'error':
      return toast.error(message, { id, duration, position, action })
    case 'loading':
      return toast.loading(message, { id })
    default:
      return toast(message, { id, duration, position, action })
  }
}

// Preset toast functions
export const successToast = (message: string, options?: ToastOptions) => 
  showToast(message, 'success', options)

export const errorToast = (message: string, options?: ToastOptions) => 
  showToast(message, 'error', options)

export const loadingToast = (message: string, options?: ToastOptions) => 
  showToast(message, 'loading', options)

export const infoToast = (message: string, options?: ToastOptions) => 
  showToast(message, 'info', options)

// Promise toast helper
export const promiseToast = <T,>(
  promise: Promise<T>,
  {
    loading = 'Loading...',
    success = 'Success!',
    error = 'Something went wrong',
    ...options
  }: {
    loading?: string
    success?: string
    error?: string
  } & ToastOptions = {}
) => {
  return toast.promise(promise, {
    loading,
    success,
    error,
    ...options
  })
} 