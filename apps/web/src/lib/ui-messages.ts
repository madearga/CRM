import { toast } from 'sonner';

/**
 * Map backend error codes to user-friendly messages in Indonesian.
 * Falls back to the original message if no mapping found.
 */
const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
  UNAUTHORIZED: 'Anda tidak memiliki izin untuk melakukan aksi ini.',
  FORBIDDEN: 'Akses ditolak. Hubungi administrator jika ini merasa salah.',
  BAD_REQUEST: 'Data yang dikirim tidak valid. Periksa kembali input Anda.',
  VALIDATION_ERROR: 'Data tidak valid. Periksa kembali form Anda.',
  CONFLICT: 'Data ini masih digunakan dan tidak bisa dihapus.',
  NOT_FOUND: 'Data tidak ditemukan. Mungkin sudah dihapus.',
  RATE_LIMITED: 'Terlalu banyak permintaan. Tunggu beberapa saat dan coba lagi.',
  INTERNAL_SERVER_ERROR: 'Terjadi kesalahan server. Coba lagi nanti.',
};

/**
 * Extract a user-friendly error message from backend error.
 * Handles both ConvexError format and generic Error.
 */
export function getErrorMessage(e: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  if (e instanceof Error) {
    return e.message;
  }

  const any = e as any;

  // ConvexError format: { data: { code, message } }
  if (any?.data?.code) {
    return ERROR_MESSAGES[any.data.code] ?? any.data.message ?? fallback;
  }

  // Direct code
  if (any?.code) {
    return ERROR_MESSAGES[any.code] ?? any.message ?? fallback;
  }

  if (typeof any?.message === 'string') {
    return any.message;
  }

  return fallback;
}

/**
 * Toast helpers with consistent UX messaging.
 */
export const ui = {
  success: {
    created: (name: string) => toast.success(`${name} berhasil dibuat`),
    updated: (name: string) => toast.success(`${name} berhasil diperbarui`),
    deleted: (name: string) => toast.success(`${name} berhasil dihapus`),
    saved: () => toast.success('Perubahan berhasil disimpan'),
    activated: (name: string) => toast.success(`${name} diaktifkan`),
    deactivated: (name: string) => toast.success(`${name} dinonaktifkan`),
    cancelled: (name: string) => toast.success(`${name} berhasil dibatalkan`),
  },
  error: {
    generic: (e: unknown) => toast.error(getErrorMessage(e)),
    validation: (msg: string) => toast.error(msg, { description: 'Periksa kembali data yang dimasukkan.' }),
    network: () => toast.error('Koneksi bermasalah', { description: 'Periksa koneksi internet dan coba lagi.' }),
    notFound: (name: string) => toast.error(`${name} tidak ditemukan`),
    inUse: (name: string) => toast.error(`${name} tidak bisa dihapus`, { description: 'Data ini masih digunakan di tempat lain.' }),
  },
  loading: {
    saving: () => toast.loading('Menyimpan...'),
    deleting: () => toast.loading('Menghapus...'),
  },
};
